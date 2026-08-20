-- Unify purchases, sales, returns, finance, shifts and shared settings.
-- Safe to run repeatedly. All stock mutations are idempotent and atomic.

create extension if not exists pgcrypto;

alter table public.purchases
  add column if not exists branch_id uuid references public.branches(id) on update cascade,
  add column if not exists branch_name text,
  add column if not exists stock_applied_at timestamptz;

create table if not exists public.varex_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_number text not null,
  branch_id uuid not null references public.branches(id) on update cascade,
  branch_name text,
  customer_ref text,
  customer_name text,
  sale_date date not null default current_date,
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  paid_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  payment_method text not null default 'نقدي',
  status text not null default 'completed',
  user_id uuid,
  user_name text,
  stock_applied_at timestamptz,
  stock_reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, sale_number)
);

create table if not exists public.varex_sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.varex_sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on update cascade,
  product_name text,
  barcode text,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.varex_returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.varex_sales(id) on update cascade,
  branch_id uuid not null references public.branches(id) on update cascade,
  return_number text not null,
  amount numeric(14,2) not null default 0,
  reason text,
  user_id uuid,
  stock_applied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, return_number)
);

create table if not exists public.varex_return_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  return_id uuid not null references public.varex_returns(id) on delete cascade,
  product_id uuid not null references public.products(id) on update cascade,
  product_name text,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.varex_financial_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on update cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('income','expense')),
  source_type text not null default 'manual',
  source_id uuid,
  description text not null,
  category text,
  amount numeric(14,2) not null default 0,
  payment_method text,
  user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists varex_financial_source_uidx
  on public.varex_financial_entries (business_id, source_type, source_id)
  where source_id is not null;

create table if not exists public.varex_business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create index if not exists varex_sales_business_date_idx
  on public.varex_sales (business_id, sale_date desc, created_at desc);
create index if not exists varex_sale_items_sale_idx
  on public.varex_sale_items (business_id, sale_id);
create index if not exists varex_finance_business_date_idx
  on public.varex_financial_entries (business_id, entry_date desc, created_at desc);

create or replace function public.varex_try_jsonb(p_text text)
returns jsonb
language plpgsql
immutable
as $$
begin
  return coalesce(p_text, '{}')::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

alter table public.varex_sales enable row level security;
alter table public.varex_sale_items enable row level security;
alter table public.varex_returns enable row level security;
alter table public.varex_return_items enable row level security;
alter table public.varex_financial_entries enable row level security;
alter table public.varex_business_settings enable row level security;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'varex_sales','varex_sale_items','varex_returns','varex_return_items',
    'varex_financial_entries','varex_business_settings'
  ] loop
    execute format('drop policy if exists varex_business_scope on public.%I', v_table);
    execute format(
      'create policy varex_business_scope on public.%I for all to authenticated using (business_id = public.get_current_business_id()) with check (business_id = public.get_current_business_id())',
      v_table
    );
  end loop;
end;
$$;

create or replace function public.varex_sync_product_totals(
  p_business_id uuid,
  p_product_ids uuid[]
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.products p
  set quantity = coalesce(t.quantity, 0), updated_at = now()
  from (
    select wanted.product_id, coalesce(sum(bi.quantity), 0) as quantity
    from unnest(p_product_ids) wanted(product_id)
    left join public.branch_inventory bi
      on bi.business_id = p_business_id
     and bi.product_id = wanted.product_id
    group by wanted.product_id
  ) t
  where p.business_id = p_business_id
    and p.id = t.product_id;
$$;

create or replace function public.varex_complete_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_purchase public.purchases%rowtype;
  v_branch_id uuid;
  v_branch_name text;
  v_products uuid[];
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'جلسة المستخدم غير صالحة.'; end if;
  v_business_id := public.get_current_business_id();
  if v_business_id is null then raise exception 'تعذر تحديد المنشأة الحالية.'; end if;

  select * into v_purchase
  from public.purchases
  where id = p_purchase_id and business_id = v_business_id
  for update;
  if not found then raise exception 'فاتورة الشراء غير موجودة.'; end if;

  v_branch_id := v_purchase.branch_id;
  if v_branch_id is null then
    select id, branch_name into v_branch_id, v_branch_name
    from public.branches
    where business_id = v_business_id and coalesce(status,'active') <> 'inactive'
    order by coalesce(is_main,false) desc, created_at asc limit 1;
  else
    select branch_name into v_branch_name from public.branches
    where id = v_branch_id and business_id = v_business_id;
  end if;
  if v_branch_id is null then raise exception 'يرجى إضافة فرع نشط قبل اعتماد المشتريات.'; end if;

  if not exists (
    select 1 from public.purchase_items
    where purchase_id = p_purchase_id and business_id = v_business_id
      and product_id is not null and quantity > 0
  ) then raise exception 'لا توجد أصناف صالحة في فاتورة الشراء.'; end if;

  if v_purchase.stock_applied_at is null then
    insert into public.branch_inventory
      (business_id, branch_id, product_id, quantity, created_at, updated_at)
    select v_business_id, v_branch_id, product_id, sum(quantity), v_now, v_now
    from public.purchase_items
    where purchase_id = p_purchase_id and business_id = v_business_id
      and product_id is not null and quantity > 0
    group by product_id
    on conflict (business_id, branch_id, product_id)
    do update set quantity = public.branch_inventory.quantity + excluded.quantity,
                  updated_at = excluded.updated_at;

    select array_agg(distinct product_id) into v_products
    from public.purchase_items
    where purchase_id = p_purchase_id and business_id = v_business_id
      and product_id is not null;
    perform public.varex_sync_product_totals(v_business_id, v_products);
  end if;

  update public.purchases
  set purchase_status = 'completed', branch_id = v_branch_id,
      branch_name = coalesce(branch_name, v_branch_name),
      stock_applied_at = coalesce(stock_applied_at, v_now), updated_at = v_now
  where id = p_purchase_id;

  insert into public.varex_financial_entries
    (business_id, branch_id, entry_date, entry_type, source_type, source_id,
     description, category, amount, payment_method, user_id)
  values
    (v_business_id, v_branch_id, coalesce(v_purchase.purchase_date,current_date),
     'expense','purchase',p_purchase_id,
     'فاتورة شراء ' || coalesce(v_purchase.purchase_number,p_purchase_id::text),
     'مشتريات',coalesce(v_purchase.total,0),v_purchase.payment_method,auth.uid())
  on conflict (business_id, source_type, source_id) where source_id is not null
  do update set amount = excluded.amount, branch_id = excluded.branch_id,
                payment_method = excluded.payment_method, updated_at = v_now;

  return jsonb_build_object('success',true,'purchase_id',p_purchase_id,
    'branch_id',v_branch_id,'stock_applied_at',coalesce(v_purchase.stock_applied_at,v_now));
end;
$$;

create or replace function public.varex_complete_sale(
  p_branch_id uuid,
  p_customer_ref text,
  p_customer_name text,
  p_payment_method text,
  p_subtotal numeric,
  p_discount numeric,
  p_tax numeric,
  p_total numeric,
  p_paid numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_branch_name text;
  v_bad_product text;
  v_products uuid[];
  v_user_name text;
  v_calc_subtotal numeric(14,2);
  v_calc_total numeric(14,2);
  v_calc_paid numeric(14,2);
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'جلسة المستخدم غير صالحة.'; end if;
  v_business_id := public.get_current_business_id();
  if v_business_id is null then raise exception 'تعذر تحديد المنشأة الحالية.'; end if;

  select branch_name into v_branch_name from public.branches
  where id = p_branch_id and business_id = v_business_id
    and coalesce(status,'active') <> 'inactive';
  if v_branch_name is null then raise exception 'الفرع المحدد غير صالح.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'لا توجد أصناف في الفاتورة.';
  end if;

  select coalesce(sum((x->>'quantity')::numeric * (x->>'price')::numeric),0)
  into v_calc_subtotal from jsonb_array_elements(p_items) x;
  v_calc_total := greatest(v_calc_subtotal-greatest(coalesce(p_discount,0),0)+greatest(coalesce(p_tax,0),0),0);
  v_calc_paid := least(greatest(coalesce(p_paid,0),0),v_calc_total);

  perform 1 from public.branch_inventory bi
  join (
    select (x->>'product_id')::uuid product_id, sum((x->>'quantity')::numeric) quantity
    from jsonb_array_elements(p_items) x group by 1
  ) n on n.product_id = bi.product_id
  where bi.business_id = v_business_id and bi.branch_id = p_branch_id
  for update of bi;

  select coalesce(p.name,n.product_id::text) into v_bad_product
  from (
    select (x->>'product_id')::uuid product_id, sum((x->>'quantity')::numeric) quantity
    from jsonb_array_elements(p_items) x group by 1
  ) n
  left join public.branch_inventory bi on bi.business_id=v_business_id
    and bi.branch_id=p_branch_id and bi.product_id=n.product_id
  left join public.products p on p.business_id=v_business_id and p.id=n.product_id
  where n.quantity <= 0 or bi.id is null or bi.quantity < n.quantity limit 1;
  if v_bad_product is not null then
    raise exception 'الكمية غير متوفرة في الفرع للمنتج: %', v_bad_product;
  end if;

  v_user_name := auth.uid()::text;
  v_sale_number := 'INV-' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');

  insert into public.varex_sales
    (business_id,sale_number,branch_id,branch_name,customer_ref,customer_name,
     sale_date,subtotal,discount,tax_amount,total,paid_amount,remaining_amount,
     payment_method,status,user_id,user_name,stock_applied_at,created_at,updated_at)
  values
    (v_business_id,v_sale_number,p_branch_id,v_branch_name,nullif(p_customer_ref,''),
     coalesce(nullif(p_customer_name,''),'عميل نقدي'),current_date,
     v_calc_subtotal,greatest(coalesce(p_discount,0),0),
     greatest(coalesce(p_tax,0),0),v_calc_total,
     v_calc_paid,greatest(v_calc_total-v_calc_paid,0),
     coalesce(nullif(p_payment_method,''),'نقدي'),'completed',auth.uid(),v_user_name,
     v_now,v_now,v_now)
  returning id into v_sale_id;

  insert into public.varex_sale_items
    (business_id,sale_id,product_id,product_name,barcode,quantity,unit_price,total)
  select v_business_id,v_sale_id,(x->>'product_id')::uuid,
    coalesce(x->>'name',p.name),coalesce(x->>'barcode',p.barcode),
    (x->>'quantity')::numeric,(x->>'price')::numeric,
    (x->>'quantity')::numeric * (x->>'price')::numeric
  from jsonb_array_elements(p_items) x
  join public.products p on p.id=(x->>'product_id')::uuid and p.business_id=v_business_id;

  update public.branch_inventory bi
  set quantity=bi.quantity-n.quantity,updated_at=v_now
  from (
    select (x->>'product_id')::uuid product_id, sum((x->>'quantity')::numeric) quantity
    from jsonb_array_elements(p_items) x group by 1
  ) n
  where bi.business_id=v_business_id and bi.branch_id=p_branch_id
    and bi.product_id=n.product_id;

  select array_agg(distinct (x->>'product_id')::uuid) into v_products
  from jsonb_array_elements(p_items) x;
  perform public.varex_sync_product_totals(v_business_id,v_products);

  insert into public.varex_financial_entries
    (business_id,branch_id,entry_date,entry_type,source_type,source_id,
     description,category,amount,payment_method,user_id)
  values (v_business_id,p_branch_id,current_date,'income','sale',v_sale_id,
    'فاتورة مبيعات '||v_sale_number,'مبيعات',v_calc_total,
    p_payment_method,auth.uid());

  -- Add the sale to the latest open cashier shift for the selected branch.
  update public.cash_sessions cs
  set total_cash_sales = coalesce(total_cash_sales,0) + case when p_payment_method='نقدي' then v_calc_total else 0 end,
      total_card_sales = coalesce(total_card_sales,0) + case when p_payment_method='بطاقة' then v_calc_total else 0 end,
      total_other_sales = coalesce(total_other_sales,0) + case when p_payment_method not in ('نقدي','بطاقة') then v_calc_total else 0 end,
      expected_balance = coalesce(expected_balance,opening_balance,0) + case when p_payment_method='نقدي' then v_calc_total else 0 end,
      updated_at = v_now
  where cs.id = (
    select id from public.cash_sessions
    where business_id=v_business_id and status='open'
      and coalesce(public.varex_try_jsonb(notes)->>'branchId','')=p_branch_id::text
    order by opened_at desc limit 1
  );

  return jsonb_build_object('success',true,'sale_id',v_sale_id,
    'sale_number',v_sale_number,'branch_id',p_branch_id,'created_at',v_now);
end;
$$;

create or replace function public.varex_create_sale_return(
  p_sale_id uuid,
  p_reason text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid := public.get_current_business_id();
  v_sale public.varex_sales%rowtype;
  v_return_id uuid;
  v_return_number text;
  v_amount numeric(14,2);
  v_products uuid[];
  v_now timestamptz := now();
begin
  if auth.uid() is null or v_business_id is null then raise exception 'جلسة المستخدم غير صالحة.'; end if;
  select * into v_sale from public.varex_sales
  where id=p_sale_id and business_id=v_business_id for update;
  if not found then raise exception 'فاتورة البيع غير موجودة.'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'لا توجد أصناف مرتجعة.'; end if;

  if exists (
    select 1 from (
      select (x->>'product_id')::uuid product_id,sum((x->>'quantity')::numeric) quantity
      from jsonb_array_elements(p_items) x group by 1
    ) r left join (
      select product_id,sum(quantity) quantity from public.varex_sale_items
      where sale_id=p_sale_id and business_id=v_business_id group by product_id
    ) s using(product_id)
    left join (
      select ri.product_id,sum(ri.quantity) quantity
      from public.varex_return_items ri
      join public.varex_returns rr on rr.id=ri.return_id
      where rr.sale_id=p_sale_id and rr.business_id=v_business_id
      group by ri.product_id
    ) previous using(product_id)
    where r.quantity<=0 or s.product_id is null
       or r.quantity+coalesce(previous.quantity,0)>s.quantity
  ) then raise exception 'كمية المرتجع تتجاوز كمية الفاتورة.'; end if;

  select sum((x->>'quantity')::numeric * (x->>'price')::numeric) into v_amount
  from jsonb_array_elements(p_items) x;
  v_return_number := 'RET-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');
  insert into public.varex_returns
    (business_id,sale_id,branch_id,return_number,amount,reason,user_id,stock_applied_at)
  values (v_business_id,p_sale_id,v_sale.branch_id,v_return_number,coalesce(v_amount,0),p_reason,auth.uid(),v_now)
  returning id into v_return_id;

  insert into public.varex_return_items
    (business_id,return_id,product_id,product_name,quantity,unit_price,total)
  select v_business_id,v_return_id,(x->>'product_id')::uuid,
    coalesce(x->>'name',p.name),(x->>'quantity')::numeric,(x->>'price')::numeric,
    (x->>'quantity')::numeric*(x->>'price')::numeric
  from jsonb_array_elements(p_items) x
  join public.products p on p.id=(x->>'product_id')::uuid and p.business_id=v_business_id;

  insert into public.branch_inventory
    (business_id,branch_id,product_id,quantity,created_at,updated_at)
  select v_business_id,v_sale.branch_id,(x->>'product_id')::uuid,
    sum((x->>'quantity')::numeric),v_now,v_now
  from jsonb_array_elements(p_items) x group by 3
  on conflict (business_id,branch_id,product_id)
  do update set quantity=public.branch_inventory.quantity+excluded.quantity,updated_at=v_now;

  select array_agg(distinct (x->>'product_id')::uuid) into v_products from jsonb_array_elements(p_items) x;
  perform public.varex_sync_product_totals(v_business_id,v_products);
  insert into public.varex_financial_entries
    (business_id,branch_id,entry_date,entry_type,source_type,source_id,description,category,amount,payment_method,user_id)
  values (v_business_id,v_sale.branch_id,current_date,'expense','return',v_return_id,
    'مرتجع مبيعات '||v_return_number,'مرتجعات',coalesce(v_amount,0),v_sale.payment_method,auth.uid());
  return jsonb_build_object('success',true,'return_id',v_return_id,'return_number',v_return_number,'amount',v_amount);
end;
$$;

revoke all on function public.varex_complete_purchase(uuid) from public;
revoke all on function public.varex_complete_sale(uuid,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb) from public;
revoke all on function public.varex_create_sale_return(uuid,text,jsonb) from public;
grant select,insert,update,delete on table public.varex_sales to authenticated,service_role;
grant select,insert,update,delete on table public.varex_sale_items to authenticated,service_role;
grant select,insert,update,delete on table public.varex_returns to authenticated,service_role;
grant select,insert,update,delete on table public.varex_return_items to authenticated,service_role;
grant select,insert,update,delete on table public.varex_financial_entries to authenticated,service_role;
grant select,insert,update,delete on table public.varex_business_settings to authenticated,service_role;
grant execute on function public.varex_complete_purchase(uuid) to authenticated, service_role;
grant execute on function public.varex_complete_sale(uuid,text,text,text,numeric,numeric,numeric,numeric,numeric,jsonb) to authenticated, service_role;
grant execute on function public.varex_create_sale_return(uuid,text,jsonb) to authenticated, service_role;

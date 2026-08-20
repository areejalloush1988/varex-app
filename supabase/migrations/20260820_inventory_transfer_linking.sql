-- Keep branch inventory and stock transfers in sync.
-- This migration is idempotent and safe to run more than once.

alter table public.stock_transfers
  add column if not exists stock_deducted_at timestamptz,
  add column if not exists stock_received_at timestamptz,
  add column if not exists stock_reversed_at timestamptz;

alter table public.stock_transfers_items
  add column if not exists barcode text,
  add column if not exists unit_cost numeric(14,3),
  add column if not exists from_branch_id uuid,
  add column if not exists to_branch_id uuid,
  add column if not exists notes text,
  add column if not exists status text not null default 'draft',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists stock_applied_at timestamptz;

create unique index if not exists branch_inventory_business_branch_product_uidx
  on public.branch_inventory (business_id, branch_id, product_id);

-- Older products may only have a total in products.quantity. Put any missing
-- amount in the main branch once, then make the product total equal to the
-- sum of its branch rows.
with product_totals as (
  select
    p.id as product_id,
    p.business_id,
    greatest(coalesce(p.quantity, 0) - coalesce(sum(bi.quantity), 0), 0) as missing_quantity
  from public.products p
  left join public.branch_inventory bi
    on bi.business_id = p.business_id
   and bi.product_id = p.id
  group by p.id, p.business_id, p.quantity
), target_branches as (
  select
    pt.*,
    (
      select b.id
      from public.branches b
      where b.business_id = pt.business_id
        and coalesce(b.status, 'active') <> 'inactive'
      order by coalesce(b.is_main, false) desc, b.created_at asc, b.id asc
      limit 1
    ) as branch_id
  from product_totals pt
  where pt.missing_quantity > 0
)
insert into public.branch_inventory (
  business_id,
  branch_id,
  product_id,
  quantity,
  created_at,
  updated_at
)
select
  business_id,
  branch_id,
  product_id,
  missing_quantity,
  now(),
  now()
from target_branches
where branch_id is not null
on conflict (business_id, branch_id, product_id)
do update set
  quantity = public.branch_inventory.quantity + excluded.quantity,
  updated_at = now();

update public.products p
set
  quantity = totals.quantity,
  updated_at = now()
from (
  select business_id, product_id, coalesce(sum(quantity), 0) as quantity
  from public.branch_inventory
  group by business_id, product_id
) totals
where p.business_id = totals.business_id
  and p.id = totals.product_id
  and p.quantity is distinct from totals.quantity;

create or replace function public.varex_set_stock_transfer_status(
  p_transfer_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_transfer public.stock_transfers%rowtype;
  v_now timestamptz := now();
  v_bad_item text;
begin
  if auth.uid() is null then
    raise exception 'جلسة المستخدم غير صالحة.';
  end if;

  if p_status not in ('draft', 'transit', 'received', 'cancelled') then
    raise exception 'حالة التحويل غير صالحة.';
  end if;

  v_business_id := public.get_current_business_id();
  if v_business_id is null then
    raise exception 'تعذر تحديد المنشأة الحالية.';
  end if;

  select *
    into v_transfer
  from public.stock_transfers
  where id = p_transfer_id
    and business_id = v_business_id
  for update;

  if not found then
    raise exception 'لم يتم العثور على التحويل ضمن المنشأة الحالية.';
  end if;

  if v_transfer.from_branch_id is null
     or v_transfer.to_branch_id is null
     or v_transfer.from_branch_id = v_transfer.to_branch_id then
    raise exception 'فرعا الإرسال والاستلام غير صالحين.';
  end if;

  if v_transfer.status = 'received' and p_status <> 'received' then
    raise exception 'لا يمكن تغيير تحويل تم استلامه.';
  end if;

  if v_transfer.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'لا يمكن إعادة فتح تحويل ملغي.';
  end if;

  if p_status = 'draft' and v_transfer.stock_deducted_at is not null then
    raise exception 'لا يمكن إعادة التحويل إلى مسودة بعد خصم المخزون.';
  end if;

  if not exists (
    select 1
    from public.stock_transfers_items sti
    where sti.transfer_id = p_transfer_id
      and sti.business_id = v_business_id
  ) then
    raise exception 'لا توجد أصناف في هذا التحويل.';
  end if;

  select coalesce(sti.product_name, sti.product_id::text, 'صنف غير معروف')
    into v_bad_item
  from public.stock_transfers_items sti
  where sti.transfer_id = p_transfer_id
    and sti.business_id = v_business_id
    and (sti.product_id is null or coalesce(sti.quantity, 0) <= 0)
  limit 1;

  if v_bad_item is not null then
    raise exception 'كمية غير صالحة في الصنف: %', v_bad_item;
  end if;

  -- Sending (or receiving directly) deducts the source exactly once.
  if p_status in ('transit', 'received')
     and v_transfer.stock_deducted_at is null then

    perform 1
    from public.branch_inventory bi
    join (
      select product_id, sum(quantity) as quantity
      from public.stock_transfers_items
      where transfer_id = p_transfer_id
        and business_id = v_business_id
      group by product_id
    ) needed on needed.product_id = bi.product_id
    where bi.business_id = v_business_id
      and bi.branch_id = v_transfer.from_branch_id
    for update of bi;

    select coalesce(p.name, needed.product_id::text, 'صنف غير معروف')
      into v_bad_item
    from (
      select product_id, sum(quantity) as quantity
      from public.stock_transfers_items
      where transfer_id = p_transfer_id
        and business_id = v_business_id
      group by product_id
    ) needed
    left join public.branch_inventory bi
      on bi.business_id = v_business_id
     and bi.branch_id = v_transfer.from_branch_id
     and bi.product_id = needed.product_id
    left join public.products p
      on p.business_id = v_business_id
     and p.id = needed.product_id
    where bi.id is null or bi.quantity < needed.quantity
    limit 1;

    if v_bad_item is not null then
      raise exception 'الكمية غير متوفرة في الفرع المرسل للصنف: %', v_bad_item;
    end if;

    update public.branch_inventory bi
    set
      quantity = bi.quantity - needed.quantity,
      updated_at = v_now
    from (
      select product_id, sum(quantity) as quantity
      from public.stock_transfers_items
      where transfer_id = p_transfer_id
        and business_id = v_business_id
      group by product_id
    ) needed
    where bi.business_id = v_business_id
      and bi.branch_id = v_transfer.from_branch_id
      and bi.product_id = needed.product_id;

    update public.stock_transfers
    set stock_deducted_at = v_now
    where id = p_transfer_id;

    v_transfer.stock_deducted_at := v_now;
  end if;

  -- Receiving adds the stock to the destination exactly once.
  if p_status = 'received'
     and v_transfer.stock_received_at is null then
    insert into public.branch_inventory (
      business_id,
      branch_id,
      product_id,
      quantity,
      created_at,
      updated_at
    )
    select
      v_business_id,
      v_transfer.to_branch_id,
      sti.product_id,
      sum(sti.quantity),
      v_now,
      v_now
    from public.stock_transfers_items sti
    where sti.transfer_id = p_transfer_id
      and sti.business_id = v_business_id
    group by sti.product_id
    on conflict (business_id, branch_id, product_id)
    do update set
      quantity = public.branch_inventory.quantity + excluded.quantity,
      updated_at = v_now;

    update public.stock_transfers_items
    set stock_applied_at = coalesce(stock_applied_at, v_now), updated_at = v_now
    where transfer_id = p_transfer_id
      and business_id = v_business_id;

    update public.stock_transfers
    set stock_received_at = v_now
    where id = p_transfer_id;

    v_transfer.stock_received_at := v_now;
  end if;

  -- Cancelling an in-transit transfer puts the deducted stock back once.
  if p_status = 'cancelled'
     and v_transfer.stock_deducted_at is not null
     and v_transfer.stock_received_at is null
     and v_transfer.stock_reversed_at is null then
    insert into public.branch_inventory (
      business_id,
      branch_id,
      product_id,
      quantity,
      created_at,
      updated_at
    )
    select
      v_business_id,
      v_transfer.from_branch_id,
      sti.product_id,
      sum(sti.quantity),
      v_now,
      v_now
    from public.stock_transfers_items sti
    where sti.transfer_id = p_transfer_id
      and sti.business_id = v_business_id
    group by sti.product_id
    on conflict (business_id, branch_id, product_id)
    do update set
      quantity = public.branch_inventory.quantity + excluded.quantity,
      updated_at = v_now;

    update public.stock_transfers
    set stock_reversed_at = v_now
    where id = p_transfer_id;

    v_transfer.stock_reversed_at := v_now;
  end if;

  update public.stock_transfers
  set status = p_status, updated_at = v_now
  where id = p_transfer_id
    and business_id = v_business_id;

  update public.stock_transfers_items
  set status = p_status, updated_at = v_now
  where transfer_id = p_transfer_id
    and business_id = v_business_id;

  update public.products p
  set
    quantity = totals.quantity,
    updated_at = v_now
  from (
    select bi.product_id, coalesce(sum(bi.quantity), 0) as quantity
    from public.branch_inventory bi
    where bi.business_id = v_business_id
      and bi.product_id in (
        select product_id
        from public.stock_transfers_items
        where transfer_id = p_transfer_id
          and business_id = v_business_id
      )
    group by bi.product_id
  ) totals
  where p.business_id = v_business_id
    and p.id = totals.product_id;

  return jsonb_build_object(
    'success', true,
    'transfer_id', p_transfer_id,
    'status', p_status,
    'stock_deducted_at', v_transfer.stock_deducted_at,
    'stock_received_at', v_transfer.stock_received_at,
    'stock_reversed_at', v_transfer.stock_reversed_at
  );
end;
$$;

revoke all on function public.varex_set_stock_transfer_status(uuid, text) from public;
grant execute on function public.varex_set_stock_transfer_status(uuid, text) to authenticated;
grant execute on function public.varex_set_stock_transfer_status(uuid, text) to service_role;

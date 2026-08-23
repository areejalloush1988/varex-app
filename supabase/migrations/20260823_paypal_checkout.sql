begin;

create table if not exists public.varex_payment_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null,
  provider text not null default 'paypal' check (provider = 'paypal'),
  billing_type text not null check (billing_type in ('monthly', 'yearly', 'lifetime')),
  plan_name text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  status text not null default 'creating'
    check (status in (
      'creating', 'created', 'approved', 'pending', 'completed', 'failed',
      'declined', 'partially_refunded', 'refunded', 'reversed', 'cancelled'
    )),
  paypal_debug_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  refunded_at timestamptz
);

create index if not exists varex_payment_orders_business_created_idx
  on public.varex_payment_orders (business_id, created_at desc);
create index if not exists varex_payment_orders_user_created_idx
  on public.varex_payment_orders (user_id, created_at desc);

create table if not exists public.varex_subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  user_id uuid not null,
  plan text not null default 'business',
  plan_name text not null,
  billing_type text not null check (billing_type in ('monthly', 'yearly', 'lifetime')),
  price numeric(12,2) not null,
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'refunded', 'reversed', 'suspended')),
  payment_status text not null default 'completed'
    check (payment_status in ('completed', 'refunded', 'reversed')),
  started_at timestamptz not null,
  expires_at timestamptz,
  lifetime boolean not null default false,
  license_key text not null unique,
  current_payment_id uuid references public.varex_payment_orders(id) on delete set null,
  paypal_order_id text,
  paypal_capture_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lifetime and expires_at is null) or (not lifetime and expires_at is not null))
);

create index if not exists varex_subscriptions_user_idx
  on public.varex_subscriptions (user_id);

create table if not exists public.varex_paypal_webhook_events (
  event_id text primary key,
  event_type text not null,
  resource_id text,
  business_id uuid references public.businesses(id) on delete cascade,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'ignored', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.varex_payment_orders enable row level security;
alter table public.varex_subscriptions enable row level security;
alter table public.varex_paypal_webhook_events enable row level security;

drop policy if exists varex_payment_orders_read_own on public.varex_payment_orders;
create policy varex_payment_orders_read_own
  on public.varex_payment_orders for select to authenticated
  using (business_id = public.get_current_business_id());

drop policy if exists varex_subscriptions_read_own on public.varex_subscriptions;
create policy varex_subscriptions_read_own
  on public.varex_subscriptions for select to authenticated
  using (business_id = public.get_current_business_id());

revoke all on table public.varex_payment_orders from public, anon, authenticated;
revoke all on table public.varex_subscriptions from public, anon, authenticated;
revoke all on table public.varex_paypal_webhook_events from public, anon, authenticated;
grant select on table public.varex_payment_orders to authenticated;
grant select on table public.varex_subscriptions to authenticated;
grant select, insert, update, delete on table public.varex_payment_orders to service_role;
grant select, insert, update, delete on table public.varex_subscriptions to service_role;
grant select, insert, update, delete on table public.varex_paypal_webhook_events to service_role;

create or replace function public.varex_apply_paypal_capture(
  p_order_id text,
  p_capture_id text,
  p_amount numeric,
  p_currency text,
  p_completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.varex_payment_orders%rowtype;
  v_current public.varex_subscriptions%rowtype;
  v_subscription public.varex_subscriptions%rowtype;
  v_started_at timestamptz := coalesce(p_completed_at, now());
  v_base timestamptz;
  v_expires_at timestamptz;
  v_lifetime boolean;
  v_license_key text;
begin
  if coalesce(trim(p_order_id), '') = '' or coalesce(trim(p_capture_id), '') = '' then
    raise exception using errcode = '22004', message = 'PayPal order and capture identifiers are required.';
  end if;

  select * into v_payment
    from public.varex_payment_orders
   where paypal_order_id = p_order_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'The VAREX PayPal order was not found.';
  end if;
  if v_payment.amount <> round(p_amount, 2) or v_payment.currency <> upper(trim(p_currency)) then
    raise exception using errcode = '22000', message = 'The captured PayPal amount does not match the VAREX order.';
  end if;
  if v_payment.paypal_capture_id is not null and v_payment.paypal_capture_id <> p_capture_id then
    raise exception using errcode = '23505', message = 'The PayPal order is already linked to a different capture.';
  end if;

  if v_payment.status = 'completed' and v_payment.paypal_capture_id = p_capture_id then
    select * into v_subscription
      from public.varex_subscriptions
     where current_payment_id = v_payment.id;
    if found then return to_jsonb(v_subscription); end if;
  end if;

  select * into v_current
    from public.varex_subscriptions
   where business_id = v_payment.business_id
   for update;

  if found and v_current.status = 'active' and v_current.lifetime then
    update public.varex_payment_orders
       set paypal_capture_id = p_capture_id,
           status = 'completed',
           completed_at = coalesce(completed_at, v_started_at),
           updated_at = now()
     where id = v_payment.id;
    return to_jsonb(v_current);
  end if;

  v_base := case
    when found and v_current.status = 'active' and v_current.expires_at > v_started_at
      then v_current.expires_at
    else v_started_at
  end;
  v_lifetime := v_payment.billing_type = 'lifetime';
  v_expires_at := case v_payment.billing_type
    when 'monthly' then v_base + interval '30 days'
    when 'yearly' then v_base + interval '365 days'
    else null
  end;
  v_license_key := coalesce(
    nullif(v_current.license_key, ''),
    'VAREX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)) || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4))
  );

  insert into public.varex_subscriptions (
    business_id, user_id, plan, plan_name, billing_type, price, currency,
    status, payment_status, started_at, expires_at, lifetime, license_key,
    current_payment_id, paypal_order_id, paypal_capture_id, updated_at
  ) values (
    v_payment.business_id, v_payment.user_id, 'business', v_payment.plan_name,
    v_payment.billing_type, v_payment.amount, v_payment.currency, 'active',
    'completed', v_started_at, v_expires_at, v_lifetime, v_license_key,
    v_payment.id, p_order_id, p_capture_id, now()
  )
  on conflict (business_id) do update set
    user_id = excluded.user_id,
    plan = excluded.plan,
    plan_name = excluded.plan_name,
    billing_type = excluded.billing_type,
    price = excluded.price,
    currency = excluded.currency,
    status = 'active',
    payment_status = 'completed',
    started_at = excluded.started_at,
    expires_at = excluded.expires_at,
    lifetime = excluded.lifetime,
    license_key = excluded.license_key,
    current_payment_id = excluded.current_payment_id,
    paypal_order_id = excluded.paypal_order_id,
    paypal_capture_id = excluded.paypal_capture_id,
    updated_at = now()
  returning * into v_subscription;

  update public.varex_payment_orders
     set paypal_capture_id = p_capture_id,
         status = 'completed',
         completed_at = coalesce(completed_at, v_started_at),
         updated_at = now()
   where id = v_payment.id;

  return to_jsonb(v_subscription);
end;
$$;

create or replace function public.varex_reverse_paypal_capture(
  p_capture_id text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.varex_payment_orders%rowtype;
  v_subscription public.varex_subscriptions%rowtype;
  v_status text := lower(trim(p_status));
begin
  if v_status not in ('refunded', 'reversed') then
    raise exception using errcode = '22023', message = 'Unsupported PayPal reversal status.';
  end if;

  select * into v_payment
    from public.varex_payment_orders
   where paypal_capture_id = p_capture_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'The PayPal capture was not found.';
  end if;

  update public.varex_payment_orders
     set status = v_status,
         refunded_at = case when v_status = 'refunded' then coalesce(refunded_at, now()) else refunded_at end,
         updated_at = now()
   where id = v_payment.id;

  update public.varex_subscriptions
     set status = v_status,
         payment_status = v_status,
         lifetime = false,
         expires_at = least(coalesce(expires_at, now()), now()),
         updated_at = now()
   where business_id = v_payment.business_id
     and current_payment_id = v_payment.id
  returning * into v_subscription;

  return coalesce(to_jsonb(v_subscription), jsonb_build_object(
    'business_id', v_payment.business_id,
    'status', v_status,
    'payment_status', v_status
  ));
end;
$$;

revoke all on function public.varex_apply_paypal_capture(text, text, numeric, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.varex_reverse_paypal_capture(text, text)
  from public, anon, authenticated;
grant execute on function public.varex_apply_paypal_capture(text, text, numeric, text, timestamptz)
  to service_role;
grant execute on function public.varex_reverse_paypal_capture(text, text)
  to service_role;

comment on table public.varex_payment_orders is
  'Server-owned PayPal order ledger. Client code cannot insert or change payment status.';
comment on table public.varex_subscriptions is
  'Authoritative VAREX subscription state activated only by verified PayPal captures.';
comment on function public.varex_apply_paypal_capture(text, text, numeric, text, timestamptz) is
  'Idempotently activates or extends a VAREX subscription after a completed PayPal capture.';

commit;

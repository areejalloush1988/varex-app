-- Standalone VAREX Trading. Only the authenticated Edge Function uses these
-- tables. Supabase Auth owns passwords, verification, and sessions.
begin;

create table public.varex_trading_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email)) and length(email) <= 254),
  display_name text not null check (length(display_name) between 2 and 80),
  role text not null default 'trader' check (role in ('developer', 'trader', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  paper_balance_cents bigint not null default 2500000 check (paper_balance_cents between 0 and 100000000000),
  created_at bigint not null,
  updated_at bigint not null,
  check (role <> 'developer' or email = 'areejalloush1988@gmail.com')
);
create index varex_trading_profile_created_idx on public.varex_trading_profile (created_at);

create table public.varex_trading_invite (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email)) and length(email) <= 254),
  display_name text not null check (length(display_name) between 2 and 80),
  role text not null default 'trader' check (role in ('trader', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at bigint,
  created_at bigint not null,
  updated_at bigint not null
);
create index varex_trading_invite_pending_idx on public.varex_trading_invite (created_at desc) where status = 'pending';

create table public.varex_trading_state (
  user_id uuid primary key references public.varex_trading_profile(user_id) on delete cascade,
  state_json jsonb not null check (jsonb_typeof(state_json) = 'object'),
  version integer not null default 1 check (version > 0),
  created_at bigint not null,
  updated_at bigint not null
);

create table public.varex_trading_broker_connection (
  user_id uuid primary key references public.varex_trading_profile(user_id) on delete cascade,
  revision uuid not null,
  provider text not null default 'binance' check (provider = 'binance'),
  account_label text not null,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  api_secret_ciphertext text not null,
  api_secret_iv text not null,
  key_fingerprint text not null check (length(key_fingerprint) <= 4),
  status text not null default 'connected' check (status in ('connected', 'error')),
  live_trading_enabled boolean not null default false,
  max_live_order_cents bigint not null default 10000 check (max_live_order_cents between 2500 and 1000000),
  permission_snapshot jsonb not null default '{}',
  last_error text,
  last_checked_at bigint,
  created_at bigint not null,
  updated_at bigint not null
);

create table public.varex_trading_live_order (
  id uuid primary key,
  user_id uuid not null references public.varex_trading_profile(user_id) on delete cascade,
  provider text not null default 'binance' check (provider = 'binance'),
  client_request_id text not null check (client_request_id ~ '^[a-f0-9]{20,64}$'),
  client_order_id text not null unique check (client_order_id ~ '^vx[a-f0-9]{32}$'),
  provider_order_id text,
  symbol text not null check (symbol in ('BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD')),
  side text not null check (side in ('buy', 'sell')),
  quote_amount_cents bigint not null check (quote_amount_cents between 2500 and 1000000),
  executed_quote_amount text,
  executed_quantity text,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'filled', 'rejected', 'unknown')),
  requested_at bigint not null,
  updated_at bigint not null,
  unique (user_id, client_request_id)
);
create index varex_trading_live_order_user_time_idx on public.varex_trading_live_order (user_id, requested_at desc);

alter table public.varex_trading_profile enable row level security;
alter table public.varex_trading_invite enable row level security;
alter table public.varex_trading_state enable row level security;
alter table public.varex_trading_broker_connection enable row level security;
alter table public.varex_trading_live_order enable row level security;

-- No direct client grants or policies: clients cannot change balances, roles,
-- risk checks, encrypted broker material, or order records through the Data API.
revoke all on public.varex_trading_profile, public.varex_trading_invite,
  public.varex_trading_state, public.varex_trading_broker_connection,
  public.varex_trading_live_order from public, anon, authenticated;
grant select, insert, update, delete on public.varex_trading_profile,
  public.varex_trading_invite, public.varex_trading_state,
  public.varex_trading_broker_connection, public.varex_trading_live_order to service_role;

-- The caller has already verified the JWT and confirmed email with Auth.getUser.
-- The email lock also serializes first registration against an admin invitation.
create function public.varex_trading_provision(
  p_user_id uuid, p_email text, p_display_name text, p_now bigint
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_profile public.varex_trading_profile%rowtype;
  v_invite public.varex_trading_invite%rowtype;
  v_role text;
begin
  if p_email is null or p_email <> lower(btrim(p_email))
      or p_display_name is null or length(p_display_name) not between 2 and 80 then
    return jsonb_build_object('reason', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('varex_trading:' || p_email, 0));
  select * into v_profile from public.varex_trading_profile where user_id = p_user_id for update;
  if found then
    if v_profile.status <> 'active'
       or (v_profile.role = 'developer' and p_email <> 'areejalloush1988@gmail.com') then
      return jsonb_build_object('reason', 'forbidden');
    end if;
    if exists (select 1 from public.varex_trading_invite where email = p_email and status = 'revoked') then
      return jsonb_build_object('reason', 'forbidden');
    end if;
    update public.varex_trading_profile
      set email = p_email,
          role = case when p_email = 'areejalloush1988@gmail.com' then 'developer' else role end,
          updated_at = case when email <> p_email then p_now else updated_at end
      where user_id = p_user_id returning * into v_profile;
    return jsonb_build_object('profile', to_jsonb(v_profile));
  end if;

  select * into v_invite from public.varex_trading_invite where email = p_email for update;
  if found and (v_invite.status = 'revoked'
      or (v_invite.accepted_by_user_id is not null and v_invite.accepted_by_user_id <> p_user_id)) then
    return jsonb_build_object('reason', 'forbidden');
  end if;
  v_role := case when p_email = 'areejalloush1988@gmail.com' then 'developer'
                 when v_invite.role = 'viewer' then 'viewer' else 'trader' end;
  insert into public.varex_trading_profile
    (user_id, email, display_name, role, status, paper_balance_cents, created_at, updated_at)
    values (p_user_id, p_email, coalesce(v_invite.display_name, p_display_name), v_role, 'active', 2500000, p_now, p_now)
    on conflict (user_id) do nothing;
  select * into v_profile from public.varex_trading_profile where user_id = p_user_id;
  if v_profile.email <> p_email or v_profile.status <> 'active' then
    return jsonb_build_object('reason', 'forbidden');
  end if;
  if v_invite.id is not null then
    update public.varex_trading_invite set status = 'accepted', accepted_by_user_id = p_user_id,
      accepted_at = p_now, updated_at = p_now where id = v_invite.id;
  end if;
  return jsonb_build_object('profile', to_jsonb(v_profile));
end;
$$;

-- Compare-and-swap and the denormalized balance update form one transaction.
-- A losing client reads the latest state and reruns its change, never overwrites it.
create function public.varex_trading_cas_state(
  p_user_id uuid, p_expected_version integer, p_state_json jsonb,
  p_require_trade boolean, p_now bigint
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_profile public.varex_trading_profile%rowtype;
  v_version integer;
  v_balance bigint;
begin
  select * into v_profile from public.varex_trading_profile where user_id = p_user_id for update;
  if not found or v_profile.status <> 'active'
      or (p_require_trade and v_profile.role not in ('developer', 'trader')) then
    return jsonb_build_object('saved', false, 'reason', 'forbidden');
  end if;
  if jsonb_typeof(p_state_json) is distinct from 'object'
      or jsonb_typeof(p_state_json -> 'balanceCents') is distinct from 'number'
      or jsonb_typeof(p_state_json -> 'trades') is distinct from 'array'
      or jsonb_typeof(p_state_json -> 'analyses') is distinct from 'array'
      or jsonb_typeof(p_state_json -> 'risk') is distinct from 'object'
      or jsonb_typeof(p_state_json -> 'settings') is distinct from 'object' then
    raise exception 'Invalid trading state' using errcode = '22023';
  end if;
  v_balance := (p_state_json ->> 'balanceCents')::bigint;
  if v_balance < 0 or v_balance > 100000000000 then
    raise exception 'Invalid paper balance' using errcode = '22023';
  end if;
  update public.varex_trading_state set state_json = p_state_json,
      version = version + 1, updated_at = p_now
    where user_id = p_user_id and version = p_expected_version
    returning version into v_version;
  if not found then return jsonb_build_object('saved', false); end if;
  update public.varex_trading_profile set paper_balance_cents = v_balance, updated_at = p_now where user_id = p_user_id;
  return jsonb_build_object('saved', true, 'version', v_version);
end;
$$;

create function public.varex_trading_manage_user(
  p_actor_user_id uuid, p_email text, p_display_name text, p_role text,
  p_status text, p_invite boolean, p_now bigint
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor public.varex_trading_profile%rowtype;
  v_target public.varex_trading_profile%rowtype;
  v_invite public.varex_trading_invite%rowtype;
begin
  select * into v_actor from public.varex_trading_profile where user_id = p_actor_user_id for update;
  if not found or v_actor.role <> 'developer' or v_actor.status <> 'active'
      or v_actor.email <> 'areejalloush1988@gmail.com'
      or p_email = 'areejalloush1988@gmail.com' then
    return jsonb_build_object('saved', false, 'reason', 'forbidden');
  end if;
  if p_email is null or p_email <> lower(btrim(p_email))
      or p_role not in ('trader', 'viewer') or p_status not in ('active', 'inactive')
      or p_display_name is null or length(p_display_name) not between 2 and 80 then
    return jsonb_build_object('saved', false, 'reason', 'invalid');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('varex_trading:' || p_email, 0));
  select * into v_target from public.varex_trading_profile where email = p_email for update;
  select * into v_invite from public.varex_trading_invite where email = p_email for update;
  if not p_invite and v_target.user_id is null and v_invite.id is null then
    return jsonb_build_object('saved', false, 'reason', 'missing');
  end if;
  insert into public.varex_trading_invite
    (email, display_name, role, status, created_by_user_id, accepted_by_user_id, accepted_at, created_at, updated_at)
    values (p_email, p_display_name, p_role,
      case when p_status = 'inactive' then 'revoked' when v_target.user_id is not null then 'accepted' else 'pending' end,
      p_actor_user_id, v_target.user_id, case when v_target.user_id is not null then p_now else null end, p_now, p_now)
    on conflict (email) do update set display_name = excluded.display_name, role = excluded.role,
      status = excluded.status, accepted_by_user_id = coalesce(excluded.accepted_by_user_id, public.varex_trading_invite.accepted_by_user_id),
      accepted_at = coalesce(excluded.accepted_at, public.varex_trading_invite.accepted_at), updated_at = excluded.updated_at;
  if v_target.user_id is not null then
    update public.varex_trading_profile set display_name = p_display_name, role = p_role,
      status = p_status, updated_at = p_now where user_id = v_target.user_id;
    if p_status = 'inactive' or p_role = 'viewer' then
      update public.varex_trading_broker_connection set live_trading_enabled = false, updated_at = p_now where user_id = v_target.user_id;
    end if;
  end if;
  return jsonb_build_object('saved', true);
end;
$$;

-- Enabling live execution and an admin role/status change lock the same profile
-- first. A refresh that started before a downgrade cannot re-enable trading.
create function public.varex_trading_enable_live(
  p_user_id uuid, p_connection_revision uuid, p_max_live_order_cents bigint, p_now bigint
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_profile public.varex_trading_profile%rowtype;
begin
  select * into v_profile from public.varex_trading_profile where user_id = p_user_id for update;
  if not found or v_profile.status <> 'active' or v_profile.role not in ('developer', 'trader') then
    return jsonb_build_object('saved', false, 'reason', 'forbidden');
  end if;
  if p_max_live_order_cents < 2500 or p_max_live_order_cents > 1000000 then
    return jsonb_build_object('saved', false, 'reason', 'limit');
  end if;
  update public.varex_trading_broker_connection set live_trading_enabled = true,
      max_live_order_cents = p_max_live_order_cents, updated_at = p_now
    where user_id = p_user_id and revision = p_connection_revision and status = 'connected';
  if not found then return jsonb_build_object('saved', false, 'reason', 'changed'); end if;
  return jsonb_build_object('saved', true);
end;
$$;

-- Claim each user request once before contacting Binance. No external call is
-- made while holding a database transaction or lock. The client ID is also
-- unique at the provider and incorporates the authenticated user's identity.
create function public.varex_trading_reserve_live_order(
  p_user_id uuid, p_id uuid, p_client_request_id text, p_client_order_id text,
  p_connection_revision uuid, p_symbol text, p_side text,
  p_quote_amount_cents bigint, p_now bigint
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_profile public.varex_trading_profile%rowtype;
  v_connection public.varex_trading_broker_connection%rowtype;
  v_order public.varex_trading_live_order%rowtype;
begin
  select * into v_profile from public.varex_trading_profile where user_id = p_user_id for update;
  if not found or v_profile.status <> 'active' or v_profile.role not in ('developer', 'trader') then
    return jsonb_build_object('reason', 'forbidden');
  end if;
  select * into v_order from public.varex_trading_live_order
    where user_id = p_user_id and client_request_id = p_client_request_id for update;
  if found then
    if v_order.symbol <> p_symbol or v_order.side <> p_side or v_order.quote_amount_cents <> p_quote_amount_cents then
      return jsonb_build_object('created', false, 'order', to_jsonb(v_order), 'reason', 'mismatch');
    end if;
    return jsonb_build_object('created', false, 'order', to_jsonb(v_order));
  end if;
  select * into v_connection from public.varex_trading_broker_connection where user_id = p_user_id for update;
  if not found or v_connection.status <> 'connected' or not v_connection.live_trading_enabled
      or v_connection.revision is distinct from p_connection_revision then
    return jsonb_build_object('reason', 'disabled');
  end if;
  if p_quote_amount_cents < 2500 or p_quote_amount_cents > v_connection.max_live_order_cents then
    return jsonb_build_object('reason', 'limit');
  end if;
  insert into public.varex_trading_live_order
    (id, user_id, client_request_id, client_order_id, symbol, side, quote_amount_cents, status, requested_at, updated_at)
    values (p_id, p_user_id, p_client_request_id, p_client_order_id, p_symbol, p_side, p_quote_amount_cents, 'pending', p_now, p_now)
    returning * into v_order;
  return jsonb_build_object('created', true, 'order', to_jsonb(v_order));
end;
$$;

revoke all on function public.varex_trading_provision(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.varex_trading_cas_state(uuid, integer, jsonb, boolean, bigint) from public, anon, authenticated;
revoke all on function public.varex_trading_manage_user(uuid, text, text, text, text, boolean, bigint) from public, anon, authenticated;
revoke all on function public.varex_trading_enable_live(uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.varex_trading_reserve_live_order(uuid, uuid, text, text, uuid, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.varex_trading_provision(uuid, text, text, bigint) to service_role;
grant execute on function public.varex_trading_cas_state(uuid, integer, jsonb, boolean, bigint) to service_role;
grant execute on function public.varex_trading_manage_user(uuid, text, text, text, text, boolean, bigint) to service_role;
grant execute on function public.varex_trading_enable_live(uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.varex_trading_reserve_live_order(uuid, uuid, text, text, uuid, text, text, bigint, bigint) to service_role;

commit;

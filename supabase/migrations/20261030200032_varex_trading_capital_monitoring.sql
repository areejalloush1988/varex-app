begin;

-- One encrypted connection per user is retained. Capital.com is account
-- monitoring only; existing Binance connections and order history are unchanged.
alter table public.varex_trading_broker_connection
  drop constraint varex_trading_broker_connection_provider_check,
  add constraint varex_trading_broker_connection_provider_check
    check (provider in ('binance', 'capital')),
  add constraint varex_trading_broker_connection_execution_provider_check
    check (provider = 'binance' or not live_trading_enabled);

create or replace function public.varex_trading_enable_live(
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
    where user_id = p_user_id and revision = p_connection_revision and provider = 'binance' and status = 'connected';
  if not found then return jsonb_build_object('saved', false, 'reason', 'changed'); end if;
  return jsonb_build_object('saved', true);
end;
$$;

-- Claim each user request once before contacting Binance. No external call is
-- made while holding a database transaction or lock. The client ID is also
-- unique at the provider and incorporates the authenticated user's identity.
create or replace function public.varex_trading_reserve_live_order(
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
  if not found or v_connection.provider <> 'binance' or v_connection.status <> 'connected' or not v_connection.live_trading_enabled
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

-- CREATE OR REPLACE preserves grants; repeat the private-call boundary explicitly.
revoke all on function public.varex_trading_enable_live(uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.varex_trading_reserve_live_order(uuid, uuid, text, text, uuid, text, text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.varex_trading_enable_live(uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.varex_trading_reserve_live_order(uuid, uuid, text, text, uuid, text, text, bigint, bigint) to service_role;

commit;

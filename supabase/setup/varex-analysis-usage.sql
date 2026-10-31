-- MANUAL SETUP DRAFT — NOT APPLIED.
-- For the existing VAREX project only. Run after reviewing the current schema,
-- using an authorized database administrator. No migrations were fabricated.
-- Existing trading/auth records and other applications are not modified.
begin;

create table if not exists public.varex_analysis_daily_usage (
  bucket_day date not null,
  bucket_key text not null check (bucket_key = 'global' or bucket_key ~ '^user:[0-9a-f-]{36}$'),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (bucket_day, bucket_key)
);
alter table public.varex_analysis_daily_usage enable row level security;
revoke all on table public.varex_analysis_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on table public.varex_analysis_daily_usage to service_role;

-- SECURITY INVOKER is deliberate: only service_role can invoke these RPCs and
-- access their table. RLS has no policies granting browser roles access.
create or replace function public.varex_analysis_usage_ready()
returns boolean
language sql
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'varex_analysis_daily_usage'
      and c.relrowsecurity
  )
  and pg_catalog.has_table_privilege(current_user, 'public.varex_analysis_daily_usage', 'SELECT')
  and pg_catalog.has_table_privilege(current_user, 'public.varex_analysis_daily_usage', 'INSERT')
  and pg_catalog.has_table_privilege(current_user, 'public.varex_analysis_daily_usage', 'UPDATE')
  and pg_catalog.has_table_privilege(current_user, 'public.varex_analysis_daily_usage', 'DELETE')
  and coalesce(pg_catalog.has_function_privilege(current_user,
    pg_catalog.to_regprocedure('public.varex_analysis_claim_request(uuid,timestamp with time zone,integer,integer)'), 'EXECUTE'), false);
$$;
revoke all on function public.varex_analysis_usage_ready() from public, anon, authenticated;
grant execute on function public.varex_analysis_usage_ready() to service_role;

create or replace function public.varex_analysis_claim_request(
  p_user_id uuid,
  p_now timestamptz default null,
  p_user_limit integer default 20,
  p_global_limit integer default 200
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  -- p_now is accepted only for transport compatibility. It NEVER selects the
  -- quota day: the database clock determines UTC accounting boundaries.
  v_clock timestamptz := statement_timestamp();
  v_day date := (v_clock at time zone 'UTC')::date;
  v_user_key text;
  v_user_count integer := 0;
  v_global_count integer := 0;
begin
  if p_user_id is null or p_user_limit is null or p_global_limit is null
    or p_user_limit < 1 or p_user_limit > 20
    or p_global_limit < 1 or p_global_limit > 200 then
    raise exception 'invalid analysis usage parameters' using errcode = '22023';
  end if;
  v_user_key := 'user:' || p_user_id::text;

  -- One transaction-scoped lock serializes both counters. Two simultaneous
  -- requests cannot each observe the last remaining global or user allowance.
  perform pg_catalog.pg_advisory_xact_lock(827431, 1);
  select request_count into v_global_count
    from public.varex_analysis_daily_usage
    where bucket_day = v_day and bucket_key = 'global';
  select request_count into v_user_count
    from public.varex_analysis_daily_usage
    where bucket_day = v_day and bucket_key = v_user_key;
  v_global_count := coalesce(v_global_count, 0);
  v_user_count := coalesce(v_user_count, 0);
  if v_user_count >= p_user_limit or v_global_count >= p_global_limit then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;

  insert into public.varex_analysis_daily_usage(bucket_day,bucket_key,request_count,updated_at)
    values (v_day, 'global', 1, v_clock), (v_day, v_user_key, 1, v_clock)
    on conflict (bucket_day,bucket_key) do update
      set request_count = public.varex_analysis_daily_usage.request_count + 1,
          updated_at = excluded.updated_at;

  -- Counts only; no prompts, market positions or personal contact data.
  delete from public.varex_analysis_daily_usage where bucket_day < v_day - 31;
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.varex_analysis_claim_request(uuid,timestamptz,integer,integer) from public, anon, authenticated;
grant execute on function public.varex_analysis_claim_request(uuid,timestamptz,integer,integer) to service_role;

commit;

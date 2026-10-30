-- Demo-only server automation. No broker credentials or live-order access.
begin;

create table public.varex_trading_bot_config (
  user_id uuid primary key references public.varex_trading_profile(user_id) on delete cascade,
  enabled boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  symbol text not null default 'BTC-USD' check (symbol in ('BTC-USD','ETH-USD','SOL-USD','ADA-USD')),
  interval text not null default '15' check (interval in ('5','15','60')),
  risk_percent numeric not null default 1 check (risk_percent between .25 and 2),
  max_daily_trades integer not null default 5 check (max_daily_trades between 1 and 20),
  last_bar_at bigint not null default 0,
  last_run_at bigint,
  next_run_at bigint not null default 0,
  last_signal text not null default 'wait' check (last_signal in ('buy','sell','wait')),
  last_message text not null default '',
  last_model jsonb,
  events jsonb not null default '[]' check (jsonb_typeof(events)='array'),
  lease_id uuid,
  lease_until bigint not null default 0,
  created_at bigint not null,
  updated_at bigint not null
);
create index varex_trading_bot_due_idx on public.varex_trading_bot_config(next_run_at) where enabled;
create table public.varex_trading_bot_runtime (
  id integer primary key check (id=1),
  scheduler_secret_hash text not null check (scheduler_secret_hash ~ '^[a-f0-9]{64}$'),
  scheduler_ready boolean not null default false,
  heartbeat_at bigint,
  job_id bigint
);
alter table public.varex_trading_bot_config enable row level security;
alter table public.varex_trading_bot_runtime enable row level security;
revoke all on public.varex_trading_bot_config, public.varex_trading_bot_runtime from public,anon,authenticated;
grant select,insert,update,delete on public.varex_trading_bot_config, public.varex_trading_bot_runtime to service_role;

create function public.varex_trading_bot_configure(
  p_user_id uuid, p_enabled boolean, p_symbol text, p_interval text,
  p_risk_percent numeric, p_max_daily_trades integer, p_expected_revision integer, p_now bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_profile public.varex_trading_profile%rowtype; v_config public.varex_trading_bot_config%rowtype;
begin
  if p_user_id is null or p_enabled is null or p_symbol is null or p_interval is null
    or p_expected_revision is null or p_expected_revision<0 or p_now is null or p_now<=0
    or p_symbol not in ('BTC-USD','ETH-USD','SOL-USD','ADA-USD') or p_interval not in ('5','15','60')
    or p_risk_percent is null or p_risk_percent not between .25 and 2
    or p_max_daily_trades is null or p_max_daily_trades not between 1 and 20 then
    return jsonb_build_object('reason','invalid');
  end if;
  select * into v_profile from public.varex_trading_profile where user_id=p_user_id for update;
  if not found or v_profile.status<>'active' or (p_enabled and v_profile.role not in ('developer','trader')) then
    return jsonb_build_object('reason','forbidden');
  end if;
  select * into v_config from public.varex_trading_bot_config where user_id=p_user_id for update;
  if coalesce(v_config.revision,0) is distinct from p_expected_revision then return jsonb_build_object('reason','conflict'); end if;
  insert into public.varex_trading_bot_config(user_id,enabled,symbol,interval,risk_percent,max_daily_trades,created_at,updated_at)
    values(p_user_id,p_enabled,p_symbol,p_interval,p_risk_percent,p_max_daily_trades,p_now,p_now)
    on conflict(user_id) do update set enabled=excluded.enabled, revision=public.varex_trading_bot_config.revision+1,
      symbol=excluded.symbol,interval=excluded.interval,risk_percent=excluded.risk_percent,max_daily_trades=excluded.max_daily_trades,
      last_bar_at=case when public.varex_trading_bot_config.symbol=excluded.symbol and public.varex_trading_bot_config.interval=excluded.interval
        then public.varex_trading_bot_config.last_bar_at else 0 end,
      lease_id=null,lease_until=0,next_run_at=0,updated_at=p_now,
      last_message=case when p_enabled then 'بانتظار الفحص المجدول التالي.' else 'تم إيقاف البوت. الصفقات التجريبية المفتوحة تبقى في سجل الصفقات.' end
    returning * into v_config;
  return jsonb_build_object('config',to_jsonb(v_config));
end; $$;

create function public.varex_trading_bot_claim(p_now bigint, p_limit integer default 20)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_cfg public.varex_trading_bot_config%rowtype; v_rows jsonb:='[]';
begin
  if p_now is null or p_now<=0 or p_limit is null or p_limit<=0 then return v_rows; end if;
  for v_id in select c.user_id from public.varex_trading_bot_config c
    join public.varex_trading_profile p on p.user_id=c.user_id
    where c.enabled and c.next_run_at<=p_now and c.lease_until<=p_now
      and p.status='active' and p.role in ('developer','trader')
    order by c.next_run_at,c.user_id limit least(greatest(p_limit,1),20)
    for update of c skip locked
  loop
    update public.varex_trading_bot_config set lease_id=gen_random_uuid(),lease_until=p_now+120000,next_run_at=p_now+60000
      where user_id=v_id returning * into v_cfg;
    v_rows:=v_rows||jsonb_build_array(to_jsonb(v_cfg));
  end loop;
  update public.varex_trading_bot_runtime set heartbeat_at=p_now where id=1;
  return v_rows;
end; $$;

create function public.varex_trading_bot_complete(
  p_user_id uuid,p_lease_id uuid,p_revision integer,p_expected_version integer,p_state_json jsonb,
  p_last_bar_at bigint,p_signal text,p_message text,p_model jsonb,p_events jsonb,p_now bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_profile public.varex_trading_profile%rowtype; v_cfg public.varex_trading_bot_config%rowtype;
  v_saved jsonb; v_events jsonb; v_state jsonb; v_version integer;
begin
  -- SQL NULL must never disable an identity, revision, or timing comparison.
  -- State/model may be NULL for a monitoring/error run; the claim metadata may not.
  if p_user_id is null or p_lease_id is null or p_revision is null or p_revision<1
    or p_expected_version is null or p_expected_version<0
    or p_last_bar_at is null or p_last_bar_at<0 or p_signal is null or p_signal not in ('buy','sell','wait')
    or p_message is null or p_now is null or p_now<=0
    or jsonb_typeof(p_events) is distinct from 'array' then return jsonb_build_object('reason','invalid'); end if;
  if jsonb_array_length(p_events)>20 then return jsonb_build_object('reason','invalid'); end if;
  -- Same lock order as manual state writes and configuration changes.
  select * into v_profile from public.varex_trading_profile where user_id=p_user_id for update;
  if not found or v_profile.status<>'active' or v_profile.role not in ('developer','trader') then return jsonb_build_object('reason','forbidden'); end if;
  select * into v_cfg from public.varex_trading_bot_config where user_id=p_user_id for update;
  if not found or not v_cfg.enabled or v_cfg.lease_id is distinct from p_lease_id
    or v_cfg.revision is distinct from p_revision or v_cfg.lease_until<=p_now then return jsonb_build_object('reason','cancelled'); end if;
  if p_state_json is not null then
    if jsonb_typeof(p_state_json) is distinct from 'object'
      or jsonb_typeof(p_state_json->'trades') is distinct from 'array' then return jsonb_build_object('reason','invalid'); end if;
    select state_json,version into v_state,v_version from public.varex_trading_state where user_id=p_user_id for update;
    if not found or v_version is distinct from p_expected_version then
      return jsonb_build_object('saved',false,'reason','conflict');
    end if;
    -- A fresh lease cannot replay an entry on an already processed candle.
    -- Exits and updates of existing positions still run between candle closes.
    if p_last_bar_at<=v_cfg.last_bar_at and exists (
      select 1 from jsonb_array_elements(p_state_json->'trades') proposed
      where left(coalesce(proposed->>'id',''),5)='auto-' and proposed->>'status'='open'
        and not exists (select 1 from jsonb_array_elements(v_state->'trades') current_trade
          where current_trade->>'id'=proposed->>'id' and current_trade->>'status'='open')
    ) then return jsonb_build_object('reason','replay'); end if;
    v_saved:=public.varex_trading_cas_state(p_user_id,p_expected_version,p_state_json,true,p_now);
    if not coalesce((v_saved->>'saved')::boolean,false) then return v_saved||jsonb_build_object('reason',coalesce(v_saved->>'reason','conflict')); end if;
  end if;
  select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb) into v_events
    from (select value,ordinality from jsonb_array_elements(p_events||v_cfg.events) with ordinality limit 100) x;
  update public.varex_trading_bot_config set last_bar_at=greatest(last_bar_at,p_last_bar_at),last_run_at=p_now,
    last_signal=p_signal,last_message=left(coalesce(p_message,''),400),last_model=p_model,events=v_events,
    lease_id=null,lease_until=0,updated_at=p_now where user_id=p_user_id;
  return jsonb_build_object('saved',true);
end; $$;

-- Revocation invalidates outstanding work permanently. Restoring a role later
-- does not restart the bot; the user must explicitly enable it again.
create function public.varex_trading_bot_revoke_on_profile_change()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.status<>'active' or new.role not in ('developer','trader') then
    update public.varex_trading_bot_config set enabled=false,revision=revision+1,
      lease_id=null,lease_until=0,next_run_at=0,updated_at=greatest(updated_at,new.updated_at),
      last_message='تم إيقاف البوت بعد تغيير صلاحية الحساب. يلزم تفعيله مجدداً بعد استعادة الصلاحية.'
      where user_id=new.user_id;
  end if;
  return new;
end; $$;
create trigger varex_trading_bot_profile_revoked
  after update of role,status on public.varex_trading_profile
  for each row when (old.role is distinct from new.role or old.status is distinct from new.status)
  execute function public.varex_trading_bot_revoke_on_profile_change();

revoke all on function public.varex_trading_bot_configure(uuid,boolean,text,text,numeric,integer,integer,bigint) from public,anon,authenticated;
revoke all on function public.varex_trading_bot_claim(bigint,integer) from public,anon,authenticated;
revoke all on function public.varex_trading_bot_complete(uuid,uuid,integer,integer,jsonb,bigint,text,text,jsonb,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.varex_trading_bot_revoke_on_profile_change() from public,anon,authenticated;
grant execute on function public.varex_trading_bot_configure(uuid,boolean,text,text,numeric,integer,integer,bigint) to service_role;
grant execute on function public.varex_trading_bot_claim(bigint,integer) to service_role;
grant execute on function public.varex_trading_bot_complete(uuid,uuid,integer,integer,jsonb,bigint,text,text,jsonb,jsonb,bigint) to service_role;
grant execute on function public.varex_trading_bot_revoke_on_profile_change() to service_role;
commit;

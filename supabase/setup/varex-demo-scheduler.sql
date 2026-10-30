-- Run after deploying varex-trading-automation. Tokens are generated/stored in
-- Supabase Vault on the database server, never copied into browser app code.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $setup$
declare v_secret text; v_job bigint;
begin
  if not exists(select 1 from vault.secrets where name='varex_trading_demo_scheduler') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'varex_trading_demo_scheduler', 'Private trigger for VAREX demo automation only');
  end if;
  select decrypted_secret into strict v_secret from vault.decrypted_secrets where name='varex_trading_demo_scheduler';
  insert into public.varex_trading_bot_runtime(id,scheduler_secret_hash,scheduler_ready)
    values(1,encode(extensions.digest(v_secret,'sha256'),'hex'),false)
    on conflict(id) do update set scheduler_secret_hash=excluded.scheduler_secret_hash;
  select cron.schedule('varex-trading-demo-24h','* * * * *', $job$
    select net.http_post(
      url:='https://eibadfdqzpeigccfdipt.supabase.co/functions/v1/varex-trading-automation',
      headers:=jsonb_build_object('Content-Type','application/json',
        'apikey','sb_publishable__xRe4q10zwB2coiWu7wVrQ_9CimA336',
        'x-varex-scheduler',(select decrypted_secret from vault.decrypted_secrets where name='varex_trading_demo_scheduler')),
      body:='{"action":"tick"}'::jsonb,timeout_milliseconds:=55000
    );
  $job$) into v_job;
  update public.varex_trading_bot_runtime set scheduler_ready=true,job_id=v_job where id=1;
end;
$setup$;

-- Metadata only: this result must never include the Vault secret or job headers.
select jobid,jobname,schedule,active from cron.job where jobname='varex-trading-demo-24h';

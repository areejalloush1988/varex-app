begin;

create table if not exists public.varex_account_deletion_jobs (
  user_id uuid primary key,
  business_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'deleting', 'data_deleted', 'auth_pending', 'failed')),
  error_code text,
  password_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.varex_account_deletion_jobs enable row level security;
revoke all on table public.varex_account_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.varex_account_deletion_jobs to service_role;

comment on table public.varex_account_deletion_jobs is
  'Server-only checkpoint used to make destructive VAREX account deletion retryable.';

create or replace function public.varex_delete_business_data(
  p_business_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_table record;
  v_rows bigint := 0;
  v_total_rows bigint := 0;
  v_business_rows bigint := 0;
  v_pass integer;
  v_progress boolean;
  v_job_status text;
begin
  if p_business_id is null or p_user_id is null then
    raise exception using errcode = '22004', message = 'Deletion identifiers are required.';
  end if;

  select status
    into v_job_status
    from public.varex_account_deletion_jobs
   where user_id = p_user_id
     and business_id = p_business_id
   for update;

  if not found then
    raise exception using errcode = '42501', message = 'A server deletion checkpoint is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text, 8675309));

  update public.varex_account_deletion_jobs
     set status = 'deleting', error_code = null, updated_at = now()
   where user_id = p_user_id;

  -- Every business-owned base table is cleared. Foreign-key dependencies are
  -- handled over several passes, so child rows are removed before their parents.
  for v_pass in 1..64 loop
    v_progress := false;

    for v_table in
      select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema
         and t.table_name = c.table_name
       where c.table_schema = 'public'
         and c.column_name = 'business_id'
         and t.table_type = 'BASE TABLE'
         and c.table_name not in ('businesses', 'varex_account_deletion_jobs')
       order by
         case
           when c.table_name like '%_items' then 0
           when c.table_name in ('sale_items', 'purchase_items', 'stock_transfer_items', 'stock_transfers_items') then 0
           when c.table_name in ('payments', 'supplier_payments', 'customer_payments', 'activity_logs') then 1
           else 2
         end,
         c.table_name
    loop
      begin
        execute format('delete from public.%I where business_id = $1', v_table.table_name)
          using p_business_id;
        get diagnostics v_rows = row_count;
        if v_rows > 0 then
          v_total_rows := v_total_rows + v_rows;
          v_progress := true;
        end if;
      exception
        when foreign_key_violation then
          -- A child table later in this pass still references these rows.
          null;
      end;
    end loop;

    exit when not v_progress;
  end loop;

  if to_regclass('public.businesses') is null then
    raise exception using errcode = '42P01', message = 'The businesses table was not found.';
  end if;

  execute 'delete from public.businesses where id = $1' using p_business_id;
  get diagnostics v_business_rows = row_count;

  if v_business_rows = 0 and v_job_status not in ('data_deleted', 'auth_pending') then
    raise exception using errcode = 'P0002', message = 'The business record was not found.';
  end if;

  update public.varex_account_deletion_jobs
     set status = 'data_deleted', error_code = null, updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object(
    'business_id', p_business_id,
    'deleted_rows', v_total_rows + v_business_rows,
    'status', 'data_deleted'
  );
exception
  when foreign_key_violation then
    raise exception using
      errcode = '23503',
      message = 'Business data has a dependency without business_id; deletion was rolled back.';
end;
$$;

revoke all on function public.varex_delete_business_data(uuid, uuid) from public, anon, authenticated;
grant execute on function public.varex_delete_business_data(uuid, uuid) to service_role;

comment on function public.varex_delete_business_data(uuid, uuid) is
  'Deletes one VAREX business transactionally. Callable only by the server service role.';

commit;

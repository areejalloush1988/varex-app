create schema if not exists private;

create table if not exists public.ai_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  industry text,
  status text not null default 'trial' check (status in ('trial','active','past_due','suspended','cancelled')),
  trial_ends_at timestamptz not null default (now() + interval '3 days'),
  timezone text not null default 'Asia/Dubai',
  ui_language text not null default 'ar',
  requires_price_approval boolean not null default true,
  audit_enabled boolean not null default true,
  auto_publish boolean not null default false,
  vat_enabled boolean not null default false,
  legal_name text,
  trn text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create or replace function private.is_ai_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ai_members
    where organization_id = org_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_ai_org_admin(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.ai_members
    where organization_id = org_id
      and user_id = (select auth.uid())
      and role in ('owner','admin')
  );
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
revoke all on function private.is_ai_org_member(uuid) from public;
revoke all on function private.is_ai_org_admin(uuid) from public;
grant execute on function private.is_ai_org_member(uuid) to authenticated;
grant execute on function private.is_ai_org_admin(uuid) to authenticated;

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  role text not null,
  objective text,
  language text not null default 'ar',
  tone text not null default 'professional_friendly',
  channels text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  requires_approval boolean not null default true,
  instructions text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  agent_id uuid references public.ai_agents(id) on delete set null,
  title text not null check (char_length(title) between 2 and 180),
  instructions text,
  status text not null default 'draft' check (status in ('draft','queued','running','awaiting_approval','completed','failed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  requires_approval boolean not null default true,
  output text,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  name text not null,
  company text,
  service text not null,
  status text not null default 'new' check (status in ('new','qualified','follow_up','won','lost')),
  source text not null default 'manual',
  priority text not null default 'medium' check (priority in ('low','medium','high','hot')),
  score integer not null default 50 check (score between 0 and 100),
  next_action text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  task_id uuid references public.ai_tasks(id) on delete set null,
  title text not null,
  summary text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'setup_required' check (status in ('setup_required','pending_credentials','pending_review','connected','error','disabled')),
  connected_account text,
  last_sync_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  contact_name text not null,
  channel text not null,
  direction text not null check (direction in ('inbound','outbound')),
  body text not null,
  send_status text not null default 'draft' check (send_status in ('draft','queued','sent','failed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  title text not null,
  file_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  storage_path text,
  status text not null default 'metadata_only' check (status in ('metadata_only','processing','ready','error')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  agent_id uuid references public.ai_agents(id) on delete set null,
  task_id uuid references public.ai_tasks(id) on delete set null,
  event_type text not null,
  units integer not null default 1 check (units > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  plan_code text not null default 'trial',
  status text not null default 'trialing' check (status in ('trialing','pending_payment','active','past_due','cancelled','expired')),
  agent_limit integer,
  monthly_task_limit integer not null default 500,
  trial_ends_at timestamptz,
  starts_at timestamptz not null default now(),
  renews_at timestamptz,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','annual','trial')),
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.ai_organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_members_user_idx on public.ai_members(user_id);
create index if not exists ai_agents_org_idx on public.ai_agents(organization_id, created_at desc);
create index if not exists ai_tasks_org_status_idx on public.ai_tasks(organization_id, status, created_at desc);
create index if not exists ai_leads_org_status_idx on public.ai_leads(organization_id, status, created_at desc);
create index if not exists ai_approvals_org_status_idx on public.ai_approvals(organization_id, status, created_at desc);
create index if not exists ai_messages_org_contact_idx on public.ai_messages(organization_id, contact_name, created_at);
create index if not exists ai_knowledge_org_idx on public.ai_knowledge_items(organization_id, created_at desc);
create index if not exists ai_usage_org_created_idx on public.ai_usage_events(organization_id, created_at desc);
create index if not exists ai_subscriptions_org_created_idx on public.ai_subscriptions(organization_id, created_at desc);
create index if not exists ai_audit_org_created_idx on public.ai_audit_logs(organization_id, created_at desc);

alter table public.ai_organizations enable row level security;
alter table public.ai_members enable row level security;
alter table public.ai_agents enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.ai_leads enable row level security;
alter table public.ai_approvals enable row level security;
alter table public.ai_integrations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_knowledge_items enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.ai_subscriptions enable row level security;
alter table public.ai_audit_logs enable row level security;

create policy "ai_org_select" on public.ai_organizations for select to authenticated
using (owner_id = (select auth.uid()) or private.is_ai_org_member(id));
create policy "ai_org_insert" on public.ai_organizations for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "ai_org_update" on public.ai_organizations for update to authenticated
using (owner_id = (select auth.uid()) or private.is_ai_org_admin(id))
with check (owner_id = (select auth.uid()) or private.is_ai_org_admin(id));

create policy "ai_members_select" on public.ai_members for select to authenticated
using (user_id = (select auth.uid()) or private.is_ai_org_member(organization_id));
create policy "ai_members_insert" on public.ai_members for insert to authenticated
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.ai_organizations o
    where o.id = organization_id and o.owner_id = (select auth.uid())
  )
);
create policy "ai_members_manage" on public.ai_members for update to authenticated
using (private.is_ai_org_admin(organization_id))
with check (private.is_ai_org_admin(organization_id));
create policy "ai_members_delete" on public.ai_members for delete to authenticated
using (private.is_ai_org_admin(organization_id) and user_id <> (select auth.uid()));

create policy "ai_agents_all" on public.ai_agents for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_tasks_all" on public.ai_tasks for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_leads_all" on public.ai_leads for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_approvals_all" on public.ai_approvals for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_integrations_all" on public.ai_integrations for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_messages_all" on public.ai_messages for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_knowledge_all" on public.ai_knowledge_items for all to authenticated
using (private.is_ai_org_member(organization_id))
with check (private.is_ai_org_member(organization_id));
create policy "ai_usage_select" on public.ai_usage_events for select to authenticated
using (private.is_ai_org_member(organization_id));
create policy "ai_usage_insert" on public.ai_usage_events for insert to authenticated
with check (private.is_ai_org_member(organization_id));
create policy "ai_subscriptions_select" on public.ai_subscriptions for select to authenticated
using (private.is_ai_org_member(organization_id));
create policy "ai_subscriptions_insert" on public.ai_subscriptions for insert to authenticated
with check (private.is_ai_org_admin(organization_id));
create policy "ai_subscriptions_update" on public.ai_subscriptions for update to authenticated
using (private.is_ai_org_admin(organization_id))
with check (private.is_ai_org_admin(organization_id));
create policy "ai_audit_select" on public.ai_audit_logs for select to authenticated
using (private.is_ai_org_member(organization_id));
create policy "ai_audit_insert" on public.ai_audit_logs for insert to authenticated
with check (private.is_ai_org_member(organization_id) and user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_organizations to authenticated;
grant select, insert, update, delete on public.ai_members to authenticated;
grant select, insert, update, delete on public.ai_agents to authenticated;
grant select, insert, update, delete on public.ai_tasks to authenticated;
grant select, insert, update, delete on public.ai_leads to authenticated;
grant select, insert, update, delete on public.ai_approvals to authenticated;
grant select, insert, update, delete on public.ai_integrations to authenticated;
grant select, insert, update, delete on public.ai_messages to authenticated;
grant select, insert, update, delete on public.ai_knowledge_items to authenticated;
grant select, insert on public.ai_usage_events to authenticated;
grant select, insert, update on public.ai_subscriptions to authenticated;
grant select, insert on public.ai_audit_logs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

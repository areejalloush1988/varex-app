create table if not exists public.varex_sales_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 2 and 100),
  phone text not null check (char_length(phone) between 7 and 32),
  email text check (email is null or char_length(email) <= 160),
  business_type text not null check (char_length(business_type) between 2 and 80),
  website_type text not null check (char_length(website_type) between 2 and 80),
  budget text not null check (char_length(budget) between 2 and 40),
  timeline text not null check (char_length(timeline) between 2 and 40),
  notes text check (notes is null or char_length(notes) <= 1200),
  language text not null default 'ar' check (language in ('ar', 'en')),
  source text not null default 'varex_sales_agent' check (char_length(source) <= 80),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'quoted', 'won', 'lost')),
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  lead_score smallint not null default 0 check (lead_score between 0 and 100),
  session_id uuid,
  ip_hash text check (ip_hash is null or char_length(ip_hash) = 64),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  page_url text check (page_url is null or char_length(page_url) <= 500),
  consent_to_contact boolean not null default true,
  consent_to_ai boolean not null default false,
  ai_recommendation text check (ai_recommendation is null or char_length(ai_recommendation) <= 1600),
  ai_model text check (ai_model is null or char_length(ai_model) <= 80),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.varex_sales_leads is 'Website sales leads captured by the VAREX sales agent. Server-owned; no direct public access.';

create index if not exists varex_sales_leads_created_at_idx
  on public.varex_sales_leads (created_at desc);

create index if not exists varex_sales_leads_status_priority_idx
  on public.varex_sales_leads (status, priority, created_at desc);

create index if not exists varex_sales_leads_ip_hash_created_at_idx
  on public.varex_sales_leads (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.varex_sales_leads enable row level security;

revoke all on table public.varex_sales_leads from anon, authenticated;
grant all on table public.varex_sales_leads to service_role;

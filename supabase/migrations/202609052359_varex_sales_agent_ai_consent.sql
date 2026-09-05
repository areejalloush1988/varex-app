alter table public.varex_sales_leads
  add column if not exists consent_to_ai boolean not null default false;

comment on column public.varex_sales_leads.consent_to_ai is
  'Whether the visitor opted in to sending only structured project choices to OpenAI for recommendation generation.';

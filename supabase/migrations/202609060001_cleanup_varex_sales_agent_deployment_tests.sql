delete from public.varex_sales_leads
where name = 'VAREX QA'
  and phone = '0000000000'
  and metadata ->> 'utm_source' = 'deployment_test';

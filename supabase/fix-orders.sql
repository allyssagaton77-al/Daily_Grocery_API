-- Copy EVERYTHING in this file into Supabase → SQL Editor → New query → Run.
-- NOT into the PowerShell terminal.

grant usage on schema public to service_role;

grant all privileges on public.orders to service_role;
grant all privileges on public.order_items to service_role;
grant all privileges on public.order_events to service_role;
grant all privileges on public.payments to service_role;
grant all privileges on public.coupons to service_role;
grant all privileges on public.carts to service_role;
grant all privileges on public.cart_items to service_role;
grant all privileges on public.ai_queries to service_role;
grant all privileges on public.profiles to service_role;

-- Also make sure future tables are covered.
alter default privileges in schema public grant all on tables to service_role;

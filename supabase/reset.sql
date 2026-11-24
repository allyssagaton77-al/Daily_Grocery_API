-- =============================================================================
-- DAILY GROCERY — RESET (only use if the first run left broken/partial tables)
-- Paste this into Supabase SQL Editor, click Run, then paste schema.sql and Run.
-- =============================================================================

drop view if exists public.product_catalog cascade;

drop table if exists
  public.ai_queries,
  public.order_events,
  public.payments,
  public.order_items,
  public.orders,
  public.payment_methods,
  public.coupons,
  public.cart_items,
  public.carts,
  public.product_reviews,
  public.product_images,
  public.products,
  public.categories,
  public.addresses,
  public.profiles
cascade;

drop function if exists public.match_products(text, integer) cascade;
drop function if exists public.validate_coupon(text, numeric) cascade;
drop function if exists public.get_cart_summary(uuid) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.prevent_role_escalation() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.user_role cascade;
drop type if exists public.order_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.payment_provider cascade;
drop type if exists public.discount_type cascade;

-- Done. Now paste the full contents of schema.sql into a NEW query and Run.

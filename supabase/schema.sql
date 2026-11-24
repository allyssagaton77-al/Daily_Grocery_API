-- =============================================================================
-- DAILY GROCERY — SUPABASE / POSTGRES DATABASE
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
--
-- This database is owned by your Express.js backend (service role key stays there).
-- The React PWA NEVER connects to Supabase directly and NEVER sees these keys.
-- RLS is enabled on every table for defense in depth.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('customer', 'staff', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('pending_payment', 'paid', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_provider as enum ('maya', 'paymongo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.discount_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 2. TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  role public.user_role not null default 'customer',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text default 'Home',
  full_name text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text not null default 'leaf',
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  unit text not null default 'pcs',
  image_url text,
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  tags text[] not null default '{}',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  position integer not null default 0
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0 and quantity <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null default 'percentage',
  discount_value numeric(10, 2) not null check (discount_value > 0),
  min_subtotal numeric(10, 2) not null default 0,
  max_discount numeric(10, 2),
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_methods (
  code text primary key,
  label text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id),
  status public.order_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'unpaid',
  payment_provider public.payment_provider,
  provider_payment_id text,
  idempotency_key text not null unique,
  subtotal numeric(10, 2) not null default 0,
  discount_amount numeric(10, 2) not null default 0,
  shipping_fee numeric(10, 2) not null default 0,
  tax_amount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  coupon_id uuid references public.coupons(id) on delete set null,
  shipping_address jsonb not null default '{}'::jsonb,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  image_url text,
  unit_price numeric(10, 2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10, 2) not null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider public.payment_provider not null,
  provider_payment_id text,
  status public.payment_status not null default 'pending',
  amount numeric(10, 2) not null,
  checkout_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null check (char_length(query) <= 280),
  answer text,
  product_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2b. SELF-HEAL — safe to re-run
-- If an earlier attempt created some tables without every column, fill the gaps
-- so this script can be pasted again without "column does not exist" errors.
-- -----------------------------------------------------------------------------
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists role public.user_role not null default 'customer';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.categories add column if not exists icon text not null default 'leaf';
alter table public.categories add column if not exists description text;
alter table public.categories add column if not exists sort_order integer not null default 0;

alter table public.products add column if not exists name text not null default '';
alter table public.products add column if not exists slug text;
alter table public.products add column if not exists price numeric(10, 2) not null default 0;
alter table public.products add column if not exists category_id uuid;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists compare_at_price numeric(10, 2);
alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists unit text not null default 'pcs';
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists rating numeric(2, 1) not null default 0;
alter table public.products add column if not exists tags text[] not null default '{}';
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists is_active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
create unique index if not exists products_slug_key on public.products(slug);

alter table public.coupons add column if not exists is_active boolean not null default true;
alter table public.coupons add column if not exists used_count integer not null default 0;
alter table public.payment_methods add column if not exists is_active boolean not null default true;
alter table public.payment_methods add column if not exists sort_order integer not null default 0;

-- -----------------------------------------------------------------------------
-- 3. INDEXES
-- -----------------------------------------------------------------------------
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active_featured on public.products(is_active, is_featured);
create index if not exists idx_products_name_trgm on public.products using gin (to_tsvector('english', name || ' ' || coalesce(description, '')));
create index if not exists idx_cart_items_cart on public.cart_items(cart_id);
create index if not exists idx_orders_user on public.orders(user_id, created_at desc);
create index if not exists idx_order_items_order on public.order_items(order_id);
create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_order_events_order on public.order_events(order_id);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS & FUNCTIONS
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists trg_carts_updated on public.carts;
create trigger trg_carts_updated before update on public.carts for each row execute function public.set_updated_at();
drop trigger if exists trg_cart_items_updated on public.cart_items;
create trigger trg_cart_items_updated before update on public.cart_items for each row execute function public.set_updated_at();
drop trigger if exists trg_orders_updated on public.orders;
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- Creates a profile automatically when someone signs up through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    'customer'::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Role changes are an admin-only operation (never trust client input).
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an admin can change a user role';
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard before update on public.profiles for each row execute function public.prevent_role_escalation();

-- Server-side cart totals (called by Express with the service role).
create or replace function public.get_cart_summary(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_subtotal numeric(10, 2);
  v_count integer;
begin
  select coalesce(sum(p.price * ci.quantity), 0), coalesce(sum(ci.quantity), 0)
    into v_subtotal, v_count
  from public.carts c
  join public.cart_items ci on ci.cart_id = c.id
  join public.products p on p.id = ci.product_id
  where c.user_id = p_user_id and p.is_active;

  return jsonb_build_object('subtotal', v_subtotal, 'itemCount', v_count);
end; $$;

-- Coupon validation (expiry, minimum spend, usage cap). Backend still owns policy.
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.coupons%rowtype;
  v_discount numeric(10, 2);
begin
  select * into c
  from public.coupons
  where upper(code) = upper(p_code)
    and is_active
    and (starts_at is null or starts_at <= now())
    and (expires_at is null or expires_at >= now())
    and (usage_limit is null or used_count < usage_limit);

  if not found then
    return jsonb_build_object('valid', false, 'code', 'COUPON_EXPIRED');
  end if;
  if coalesce(p_subtotal, 0) < c.min_subtotal then
    return jsonb_build_object('valid', false, 'code', 'COUPON_MIN_SUBTOTAL', 'minSubtotal', c.min_subtotal);
  end if;

  if c.discount_type = 'percentage' then
    v_discount := round(p_subtotal * c.discount_value / 100, 2);
    if c.max_discount is not null then v_discount := least(v_discount, c.max_discount); end if;
  else
    v_discount := least(c.discount_value, p_subtotal);
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', c.code,
    'label', c.description,
    'discountType', c.discount_type,
    'discountValue', c.discount_value,
    'discount', v_discount
  );
end; $$;

-- Grounded product search used by the /api/v1/ai/recommendations backend route.
-- It only returns REAL catalog rows with REAL prices and stock.
create or replace function public.match_products(p_query text, p_limit integer default 6)
returns table (
  id uuid, name text, description text, price numeric,
  image_url text, stock integer, category text, rating numeric
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.name, p.description, p.price, p.image_url,
    p.stock, coalesce(c.name, 'Fresh'), p.rating
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.is_active
    and (
      p_query is null or btrim(p_query) = '' or
      p.name ilike '%' || btrim(p_query) || '%' or
      coalesce(p.description, '') ilike '%' || btrim(p_query) || '%' or
      coalesce(c.name, '') ilike '%' || btrim(p_query) || '%' or
      exists (select 1 from unnest(p.tags) t where t ilike '%' || btrim(p_query) || '%')
    )
  order by
    case when p.name ilike btrim(p_query) || '%' then 0 else 1 end,
    p.is_featured desc, p.rating desc, p.name
  limit least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_reviews enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.payment_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.ai_queries enable row level security;

-- Catalog: public read, admin write.
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);
drop policy if exists "admin write categories" on public.categories;
create policy "admin write categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select using (is_active or public.is_admin());
drop policy if exists "admin write products" on public.products;
create policy "admin write products" on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read product images" on public.product_images;
create policy "public read product images" on public.product_images for select using (true);
drop policy if exists "admin write product images" on public.product_images;
create policy "admin write product images" on public.product_images for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read reviews" on public.product_reviews;
create policy "public read reviews" on public.product_reviews for select using (true);
drop policy if exists "users write own reviews" on public.product_reviews;
create policy "users write own reviews" on public.product_reviews for insert with check (auth.uid() = user_id);
drop policy if exists "users delete own reviews" on public.product_reviews;
create policy "users delete own reviews" on public.product_reviews for delete using (auth.uid() = user_id or public.is_admin());

-- Profiles: owner or admin. Role escalation blocked by trigger above.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id or public.is_admin());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Addresses: owner only.
drop policy if exists "own addresses" on public.addresses;
create policy "own addresses" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Carts and cart items: owner only.
drop policy if exists "own cart" on public.carts;
create policy "own cart" on public.carts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own cart items" on public.cart_items;
create policy "own cart items" on public.cart_items for all using (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
);

-- Coupons / payment methods: readable by signed-in shoppers, writable by admin only.
drop policy if exists "authenticated read coupons" on public.coupons;
create policy "authenticated read coupons" on public.coupons for select to authenticated using (is_active or public.is_admin());
drop policy if exists "admin write coupons" on public.coupons;
create policy "admin write coupons" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "public read payment methods" on public.payment_methods;
create policy "public read payment methods" on public.payment_methods for select using (is_active or public.is_admin());
drop policy if exists "admin write payment methods" on public.payment_methods;
create policy "admin write payment methods" on public.payment_methods for all using (public.is_admin()) with check (public.is_admin());

-- Orders and children: read own or admin. Writes happen in Express via service role.
drop policy if exists "read own orders" on public.orders;
create policy "read own orders" on public.orders for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "read own order items" on public.order_items;
create policy "read own order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "read own order events" on public.order_events;
create policy "read own order events" on public.order_events for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "own ai queries" on public.ai_queries;
create policy "own ai queries" on public.ai_queries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants (Supabase already grants broadly; these make intent explicit).
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_reviews, public.payment_methods to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.addresses, public.carts, public.cart_items, public.product_reviews, public.ai_queries to authenticated;
grant select on public.coupons, public.orders, public.order_items, public.payments, public.order_events to authenticated;
grant execute on function public.match_products(text, integer), public.validate_coupon(text, numeric), public.get_cart_summary(uuid), public.is_admin() to anon, authenticated;

-- The Express backend uses the service_role key. It needs table privileges too.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- -----------------------------------------------------------------------------
-- 6. SEED DATA — the sample grocery look from the reference image
-- -----------------------------------------------------------------------------
insert into public.categories (name, slug, icon, sort_order) values
  ('Fruits',      'fruits',      'heart',   1),
  ('Vegetables',  'vegetables',  'leaf',    2),
  ('Dairy & Eggs','dairy-eggs',  'package', 3),
  ('Bakery',      'bakery',      'bag',     4),
  ('Beverages',   'beverages',   'card',    5),
  ('Snacks',      'snacks',      'star',    6)
on conflict (slug) do nothing;

insert into public.products (name, slug, category_id, description, price, compare_at_price, stock, unit, image_url, rating, tags, is_featured) values
  ('Apples',          'apples',           (select id from categories where slug='fruits'),      'Crisp red apples, hand-picked for freshness.',        145.00, 169.00, 48, 'kg',    'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&h=600&fit=crop', 4.8, '{fruit,fresh,breakfast}', true),
  ('Fresh Orange',    'fresh-orange',     (select id from categories where slug='fruits'),      'Juicy oranges packed with vitamin C.',                 89.00, null,   72, 'kg',    'https://images.unsplash.com/photo-1547514701-42782101795e?w=600&h=600&fit=crop', 4.7, '{fruit,citrus}', true),
  ('Grapes',          'grapes',           (select id from categories where slug='fruits'),      'Sweet seedless grapes, chilled and ready.',            120.00, 139.00, 35, 'pack', 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600&h=600&fit=crop', 4.6, '{fruit,snack}', true),
  ('Strawberry',      'strawberry',       (select id from categories where slug='fruits'),      'Farm-fresh strawberries, perfect for desserts.',       198.00, null,   22, 'pack', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600&h=600&fit=crop', 4.9, '{fruit,berry}', true),
  ('Lemon',           'lemon',            (select id from categories where slug='fruits'),      'Zesty lemons for drinks and cooking.',                  65.00, null,   90, 'pcs',   'https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&h=600&fit=crop', 4.5, '{fruit,citrus}', false),
  ('Figs',            'figs',             (select id from categories where slug='fruits'),      'Ripe, naturally sweet figs.',                          175.00, null,   18, 'pack', 'https://images.unsplash.com/photo-1600428877878-4a0f23f6f9f2?w=600&h=600&fit=crop', 4.4, '{fruit,premium}', false),
  ('Watermelon',      'watermelon',       (select id from categories where slug='fruits'),      'Cool, refreshing watermelon.',                         149.00, null,   26, 'pcs',   'https://images.unsplash.com/photo-1563114773-84221bd62daa?w=600&h=600&fit=crop', 4.7, '{fruit,summer}', true),
  ('Banana',          'banana',           (select id from categories where slug='fruits'),      'Energy-packed bananas, great for breakfast.',          58.00, null,    110, 'kg',   'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600&h=600&fit=crop', 4.8, '{fruit,breakfast}', true),
  ('Capsicum',        'capsicum',         (select id from categories where slug='vegetables'),  'Colorful bell peppers for salads and stir-fry.',       95.00, null,   40, 'pcs',   'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=600&h=600&fit=crop', 4.5, '{vegetable,salad}', true),
  ('Tomatoes',        'tomatoes',         (select id from categories where slug='vegetables'),  'Plump tomatoes for everyday cooking.',                 72.00, null,   64, 'kg',    'https://images.unsplash.com/photo-1546470427-e5b89a2e8b17?w=600&h=600&fit=crop', 4.6, '{vegetable,cooking}', true),
  ('Potatoes',        'potatoes',         (select id from categories where slug='vegetables'),  'All-purpose potatoes, farm grown.',                    62.00, null,   80, 'kg',    'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&h=600&fit=crop', 4.4, '{vegetable,cooking}', false),
  ('Cabbage',         'cabbage',          (select id from categories where slug='vegetables'),  'Fresh, tightly packed cabbage.',                       55.00, null,   45, 'pcs',   'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600&h=600&fit=crop', 4.3, '{vegetable}', false),
  ('Carrots',         'carrots',          (select id from categories where slug='vegetables'),  'Sweet crunchy carrots.',                                68.00, null,   55, 'kg',    'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&h=600&fit=crop', 4.6, '{vegetable}', false),
  ('Fresh Milk',      'fresh-milk',       (select id from categories where slug='dairy-eggs'),   'Farm-fresh whole milk, 1 L.',                          98.00, null,   38, 'L',     'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&h=600&fit=crop', 4.7, '{dairy,breakfast}', true),
  ('Free-range Eggs', 'free-range-eggs',  (select id from categories where slug='dairy-eggs'),   'A dozen free-range eggs.',                             135.00, null,  30, 'dozen', 'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=600&h=600&fit=crop', 4.8, '{eggs,breakfast}', true),
  ('Artisan Bread',   'artisan-bread',    (select id from categories where slug='bakery'),       'Freshly baked sourdough loaf.',                        110.00, null,  20, 'loaf',  'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&h=600&fit=crop', 4.9, '{bakery}', true),
  ('Ground Coffee',   'ground-coffee',    (select id from categories where slug='beverages'),    'Rich aromatic ground coffee, 250 g.',                 249.00, 279.00, 25, 'pack',  'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=600&h=600&fit=crop', 4.8, '{coffee,breakfast}', true),
  ('Chicken Breast',  'chicken-breast',   (select id from categories where slug='vegetables'),   'Boneless chicken breast, chilled.',                    210.00, null,  16, 'kg',    'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600&h=600&fit=crop', 4.6, '{protein}', false)
on conflict (slug) do nothing;

insert into public.coupons (code, description, discount_type, discount_value, min_subtotal, max_discount, starts_at, expires_at, usage_limit, is_active) values
  ('WELCOME10', '10% off your first order', 'percentage', 10, 300, 150, now(), now() + interval '1 year', 1000, true),
  ('FRESH20',   '₱20 off fresh picks',      'fixed',      20, 200, null, now(), now() + interval '1 year', 500,  true),
  ('FRUIT15',   '15% off fruits',           'percentage', 15, 500, 200, now(), now() + interval '6 months', 300, true)
on conflict (code) do nothing;

insert into public.payment_methods (code, label, description, is_active, sort_order) values
  ('maya',     'Maya',     'Sandbox · GCash and cards',        true, 1),
  ('paymongo', 'PayMongo', 'Sandbox · cards and e-wallets',    true, 2)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- 7. USEFUL VIEW
-- -----------------------------------------------------------------------------
create or replace view public.product_catalog as
select
  p.id, p.name, p.slug, p.description, p.price, p.compare_at_price,
  p.stock, p.unit, p.image_url, p.rating, p.tags, p.is_featured,
  c.id as category_id, c.name as category_name, c.slug as category_slug
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active;

grant select on public.product_catalog to anon, authenticated;

-- =============================================================================
-- DONE. Next: in Supabase → Project Settings → API, copy the Project URL and the
-- service_role key into your EXPRESS backend .env (never into the React .env).
-- Frontend .env only needs VITE_API_BASE_URL.
-- =============================================================================

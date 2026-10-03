-- =====================================================================
-- RSN — initial database schema (tables, types, automatic timestamps)
--
-- Money is stored in KOBO as whole numbers (₦85,000 = 8,500,000 kobo).
-- Whole numbers never have rounding errors, and Paystack also works in kobo,
-- so amounts can be compared exactly when verifying a payment.
--
-- Security rules (who can read/write what) live in the next migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fixed lists of allowed values
-- ---------------------------------------------------------------------
create type public.product_audience as enum ('men', 'women', 'unisex');

create type public.payment_method as enum ('paystack', 'bank_transfer');

-- Payment status and fulfilment (delivery) status are kept separate on purpose.
create type public.payment_status as enum (
  'pending',                -- order created, nothing paid yet
  'awaiting_verification',  -- bank transfer: proof uploaded, RSN must check the bank account
  'confirmed',              -- money verified (Paystack check or admin confirmation)
  'failed',                 -- Paystack payment failed
  'rejected',               -- admin checked: the transfer did not arrive
  'refunded'
);

create type public.fulfilment_status as enum (
  'pending',     -- waiting for payment confirmation
  'processing',  -- being prepared for dispatch
  'shipped',
  'delivered',
  'cancelled'
);

create type public.shopping_request_status as enum ('new', 'in_progress', 'responded', 'closed');

-- ---------------------------------------------------------------------
-- Helper: keeps every table's updated_at column current automatically
-- ---------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Admins: the list of user accounts allowed into the admin area.
-- Kept in its own table (not a "role" column customers could edit).
-- Add someone by running an INSERT in the Supabase SQL Editor.
-- ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Profiles: one row per customer account (created automatically on sign-up)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  delivery_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- When someone signs up (e.g. with Google), copy their name and email into a profile.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Categories: one table for both levels.
--   Top level (parent_id is empty): Shoes, Clothing, Accessories
--   Subcategories (parent_id points to the top level): Sneakers, Brogues, ...
-- More categories or deeper levels can be added later without changing tables.
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  tagline text,
  image_path text, -- path inside the "catalog-images" storage bucket
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is distinct from id)
);

create index categories_parent_id_idx on public.categories (parent_id);

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Products
-- category_id points to the most specific category (usually a subcategory,
-- e.g. Sneakers); its parent gives the top-level category (Shoes).
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  category_id uuid not null references public.categories (id) on delete restrict,
  price_kobo bigint not null check (price_kobo >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  audience public.product_audience not null default 'unisex',
  tag text, -- optional label such as "New" or "Hot"
  keywords text[] not null default '{}', -- extra search words, e.g. {'af1','air force'}
  is_active boolean not null default true, -- inactive products are hidden from customers
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_id_idx on public.products (category_id);
create index products_is_active_idx on public.products (is_active);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Product images: several photos per product, stored in Supabase Storage
-- ---------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null, -- path inside the "catalog-images" bucket
  alt_text text not null default '',
  sort_order integer not null default 0, -- the lowest number is the main photo
  created_at timestamptz not null default now()
);

create index product_images_product_id_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------
-- Store settings: a single row of shop-wide settings the admin can change,
-- such as the bank details shown at checkout.
-- ---------------------------------------------------------------------
create table public.store_settings (
  id integer primary key default 1 check (id = 1), -- only one row allowed
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  updated_at timestamptz not null default now()
);

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Orders
-- Delivery details are copied onto the order, so later profile changes
-- don't rewrite where a past order was sent.
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('RSN-' || lpad(nextval('public.order_number_seq')::text, 6, '0')),
  customer_id uuid not null references public.profiles (id) on delete restrict,

  subtotal_kobo bigint not null check (subtotal_kobo >= 0),
  delivery_fee_kobo bigint not null default 0 check (delivery_fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo = subtotal_kobo + delivery_fee_kobo),

  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  fulfilment_status public.fulfilment_status not null default 'pending',

  delivery_name text not null,
  delivery_email text not null,
  delivery_phone text not null,
  delivery_address_line1 text not null,
  delivery_address_line2 text,
  delivery_city text not null,
  delivery_state text not null,
  delivery_instructions text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Safety rule enforced by the database itself: an order can only move past
  -- "pending" (into processing/shipped/delivered) once payment is confirmed.
  -- So an uploaded receipt can never release an order for fulfilment.
  constraint orders_fulfilment_requires_payment check (
    fulfilment_status in ('pending', 'cancelled')
    or payment_status in ('confirmed', 'refunded')
  )
);

create index orders_customer_id_idx on public.orders (customer_id, created_at desc);
create index orders_payment_status_idx on public.orders (payment_status);
create index orders_fulfilment_status_idx on public.orders (fulfilment_status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Order items: the price is copied at the time of purchase, so later
-- price changes never alter past orders.
-- ---------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  line_total_kobo bigint generated always as (unit_price_kobo * quantity) stored,
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------
-- Payments: one row per payment attempt (a failed Paystack attempt
-- followed by a successful one gives two rows for the same order).
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  method public.payment_method not null,
  amount_kobo bigint not null check (amount_kobo > 0),
  status public.payment_status not null default 'pending',
  paystack_reference text unique, -- only for Paystack payments
  verified_at timestamptz,        -- when Paystack verification or an admin confirmed it
  verified_by uuid references auth.users (id) on delete set null, -- the admin, for bank transfers
  rejection_reason text,          -- shown to the customer if a transfer is rejected
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_order_id_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Bank-transfer proofs: the uploaded receipt. Storing one does NOT confirm
-- the payment — an admin must check the real bank account first.
-- ---------------------------------------------------------------------
create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null, -- path inside the private "payment-proofs" bucket
  customer_note text,         -- e.g. "Sent from my GTBank account at 2:15pm"
  created_at timestamptz not null default now()
);

create index payment_proofs_payment_id_idx on public.payment_proofs (payment_id);

-- ---------------------------------------------------------------------
-- Personal shopping requests ("Can't find it? Tell RSN")
-- Visitors don't need an account; user_id is filled in when they are signed in.
-- ---------------------------------------------------------------------
create table public.personal_shopping_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email text not null check (position('@' in email) > 1),
  phone text,
  description text not null check (length(trim(description)) > 0), -- what they are looking for
  size text,
  colour text,
  preferred_brand text,
  budget_kobo bigint check (budget_kobo is null or budget_kobo >= 0),
  status public.shopping_request_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_shopping_requests_status_idx
  on public.personal_shopping_requests (status, created_at desc);
create index personal_shopping_requests_user_id_idx
  on public.personal_shopping_requests (user_id);

create trigger personal_shopping_requests_set_updated_at
  before update on public.personal_shopping_requests
  for each row execute function public.set_updated_at();

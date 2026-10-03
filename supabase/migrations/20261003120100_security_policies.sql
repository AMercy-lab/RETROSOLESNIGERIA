-- =====================================================================
-- RSN — security rules (Row Level Security)
--
-- How this works, in plain English:
--   * Every table is LOCKED by default ("deny by default").
--   * We then open exactly what each kind of visitor needs:
--       anon          = a visitor who is not signed in
--       authenticated = a signed-in customer (or admin)
--   * Admin powers are checked by the database itself through is_admin(),
--     so hiding a link on the website is never what protects admin data.
--   * Trusted server code (our Next.js backend, using the secret key)
--     bypasses these rules. That is how orders get created with prices
--     taken from the database — never from the browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_admin(): true when the signed-in user is listed in public.admins
-- ---------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Internal trigger helpers must never be called directly by visitors.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Turn on Row Level Security everywhere and remove all default access
-- ---------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.personal_shopping_requests enable row level security;

revoke all on
  public.admins, public.profiles, public.categories, public.products,
  public.product_images, public.store_settings, public.orders,
  public.order_items, public.payments, public.payment_proofs,
  public.personal_shopping_requests
from anon, authenticated;

revoke all on sequence public.order_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------
-- Admins list: only admins can see who the admins are.
-- Nobody can add admins through the website/app; use the SQL Editor.
-- ---------------------------------------------------------------------
grant select on public.admins to authenticated;

create policy "Admins can view the admin list"
  on public.admins for select to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Profiles: customers see and edit only their own; admins see everyone.
-- Customers can only change their contact/delivery fields (not id or email).
-- ---------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, address_line1, address_line2, city, state, delivery_instructions)
  on public.profiles to authenticated;

create policy "Customers can view their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Catalogue (categories, products, product images):
-- everyone can browse ACTIVE items; only admins can see inactive ones or make changes.
-- ---------------------------------------------------------------------
grant select on public.categories, public.products, public.product_images to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images to authenticated;

create policy "Anyone can view active categories"
  on public.categories for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Admins can add categories"
  on public.categories for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit categories"
  on public.categories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete categories"
  on public.categories for delete to authenticated
  using ((select public.is_admin()));

create policy "Anyone can view active products"
  on public.products for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy "Admins can add products"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit products"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete products"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

create policy "Anyone can view images of active products"
  on public.product_images for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
      where p.id = product_images.product_id and p.is_active
    )
  );

create policy "Admins can add product images"
  on public.product_images for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admins can edit product images"
  on public.product_images for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can delete product images"
  on public.product_images for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Store settings: everyone can read (bank details are shown at checkout);
-- only admins can change them.
-- ---------------------------------------------------------------------
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

create policy "Anyone can view store settings"
  on public.store_settings for select to anon, authenticated
  using (true);

create policy "Admins can edit store settings"
  on public.store_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Orders and order items: customers see only their own; admins see all.
-- Customers can NOT create or change orders directly — orders are created by
-- our server code, which takes prices from the database.
-- Only admins can update orders (e.g. confirm payment, mark as shipped).
-- ---------------------------------------------------------------------
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "Customers can view their own orders"
  on public.orders for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins can update orders"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Customers can view items in their own orders"
  on public.order_items for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.customer_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- Payments: customers can see payments for their own orders; only admins
-- can change them. Paystack confirmations are written by server code.
-- ---------------------------------------------------------------------
grant select, update on public.payments to authenticated;

create policy "Customers can view payments for their own orders"
  on public.payments for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = payments.order_id and o.customer_id = (select auth.uid())
    )
  );

create policy "Admins can update payments"
  on public.payments for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- Payment proofs: a customer can upload a proof only for a bank-transfer
-- payment on their OWN order, and can see their own uploads. Admins see all.
-- Nobody can edit or delete a proof through the website/app.
-- ---------------------------------------------------------------------
grant select, insert on public.payment_proofs to authenticated;

create policy "Customers can view their own payment proofs"
  on public.payment_proofs for select to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_admin()));

create policy "Customers can upload proof for their own bank transfer"
  on public.payment_proofs for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and exists (
      select 1
      from public.payments p
      join public.orders o on o.id = p.order_id
      where p.id = payment_proofs.payment_id
        and o.customer_id = (select auth.uid())
        and p.method = 'bank_transfer'
    )
  );

-- ---------------------------------------------------------------------
-- Personal shopping requests: submitted through our server code (which
-- validates them and emails RSN). Signed-in customers can see their own;
-- admins can see and update all.
-- ---------------------------------------------------------------------
grant select, update on public.personal_shopping_requests to authenticated;

create policy "Customers can view their own shopping requests"
  on public.personal_shopping_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins can update shopping requests"
  on public.personal_shopping_requests for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

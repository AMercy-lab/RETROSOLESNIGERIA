-- =====================================================================
-- RSN — customer accounts: the same orders on the website AND the app
--
--   A customer signs in with their email (a one-time code, no password).
--   Their orders are then linked to their account, so every device they
--   sign in on shows the same orders, payments and receipts.
--
--   Nothing about how orders are checked changes: an account simply lets
--   our server look up the order's existing private-link fingerprint and
--   use the same guest_* functions as before. No secrets are stored.
--
--   1. claim_orders_by_email(): when someone signs in, orders placed with
--      that (now verified) email as a guest are linked to their account.
--   2. claim_order(): links an order just placed by a signed-in customer.
--   3. customer_order_hash(): the fingerprint of one of MY orders.
--   4. customer_orders(): all my orders, newest first.
--   Only our server (secret key) may call these.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Link guest orders placed with the account's verified email.
-- ---------------------------------------------------------------------
create function public.claim_orders_by_email(p_customer_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer;
begin
  -- Only an email the customer has proved they own (by entering the code).
  select lower(u.email) into v_email from auth.users u
    where u.id = p_customer_id and u.email_confirmed_at is not null;
  if v_email is null or v_email = '' then
    return 0;
  end if;

  -- orders.customer_id points at profiles; make sure the profile exists.
  insert into public.profiles (id, email) values (p_customer_id, v_email)
    on conflict (id) do nothing;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.orders
    set customer_id = p_customer_id
    where customer_id is null and lower(delivery_email) = v_email;
  get diagnostics v_count = row_count;
  perform set_config('rsn.trusted_change', 'off', true);

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Link an order the signed-in customer has just placed.
--    The private-link fingerprint proves it is that customer's new order.
-- ---------------------------------------------------------------------
create function public.claim_order(p_order_id uuid, p_customer_id uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count integer;
begin
  if p_order_id is null or p_customer_id is null or p_token_hash is null then
    return false;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = p_customer_id;
  if not found then
    return false;
  end if;
  insert into public.profiles (id, email) values (p_customer_id, v_email)
    on conflict (id) do nothing;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.orders
    set customer_id = p_customer_id
    where id = p_order_id and guest_access_token_hash = p_token_hash and customer_id is null;
  get diagnostics v_count = row_count;
  perform set_config('rsn.trusted_change', 'off', true);

  return v_count > 0;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. The private-link fingerprint of an order that belongs to me
--    (null if it isn't mine). Our server then uses the guest_* functions.
-- ---------------------------------------------------------------------
create function public.customer_order_hash(p_order_id uuid, p_customer_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select o.guest_access_token_hash from public.orders o
    where o.id = p_order_id and o.customer_id = p_customer_id;
$$;

-- ---------------------------------------------------------------------
-- 4. My orders, newest first (the same details as the order page).
-- ---------------------------------------------------------------------
create function public.customer_orders(p_customer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(d.details order by d.created_at desc), '[]'::jsonb)
  from (
    select o.created_at, public.guest_order_details(o.id, o.guest_access_token_hash) as details
    from public.orders o
    where o.customer_id = p_customer_id and o.guest_access_token_hash is not null
    order by o.created_at desc
    limit 50
  ) d
  where d.details is not null;
$$;

revoke execute on function
  public.claim_orders_by_email(uuid),
  public.claim_order(uuid, uuid, text),
  public.customer_order_hash(uuid, uuid),
  public.customer_orders(uuid)
from public, anon, authenticated;

grant execute on function
  public.claim_orders_by_email(uuid),
  public.claim_order(uuid, uuid, text),
  public.customer_order_hash(uuid, uuid),
  public.customer_orders(uuid)
to service_role;

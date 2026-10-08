-- =====================================================================
-- TEST RUN for 20261010090000_customer_accounts.sql — changes NOTHING.
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It installs the new functions, makes two pretend customers and orders,
-- checks everything, then deliberately stops with an error so the
-- database UNDOES all of it.
--
--   Success looks like a red message:  RSN TEST PASSED (everything was undone)
--   Any other message means a check failed — nothing was saved either way.
-- =====================================================================

begin;
-- ---- 1. the migration, exactly as it will be applied ----
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

-- ---- 2. the checks ----
do $$
declare
  v_me uuid := gen_random_uuid();
  v_unverified uuid := gen_random_uuid();
  v_product public.products;
  v_size text;
  v_items jsonb;
  v_hash1 text := encode(sha256('rsn-test-token-one'::bytea), 'hex');
  v_hash2 text := encode(sha256('rsn-test-token-two'::bytea), 'hex');
  v_order1 uuid;
  v_order2 uuid;
  v_list jsonb;
  v_blocked boolean := false;
begin
  -- Two pretend accounts: one has proved its email, one has not.
  insert into auth.users (id, email, email_confirmed_at, aud, role)
    values (v_me, 'rsn-test-me@example.com', now(), 'authenticated', 'authenticated'),
           (v_unverified, 'rsn-test-other@example.com', null, 'authenticated', 'authenticated');

  select * into v_product from public.products where is_active limit 1;
  if not found then raise exception 'TEST SETUP: no active product to order'; end if;
  v_size := case when cardinality(v_product.sizes) > 0 then v_product.sizes[1] end;
  v_items := jsonb_build_array(jsonb_build_object('product_id', v_product.id, 'size', v_size, 'quantity', 1));

  -- Order 1: a guest order using MY email. Order 2: a guest order with another email.
  select order_id into v_order1 from public.place_order(null, v_hash1, 'bank_transfer',
    '{"name":"Test Me","email":"RSN-Test-Me@example.com","phone":"08030000000","address":"1 Test Street","city":"Ikeja","state":"Lagos"}', v_items);
  select order_id into v_order2 from public.place_order(null, v_hash2, 'bank_transfer',
    '{"name":"Test Other","email":"rsn-test-other@example.com","phone":"08030000001","address":"2 Test Street","city":"Ikeja","state":"Lagos"}', v_items);

  -- Before signing in: no orders on my account.
  if jsonb_array_length(public.customer_orders(v_me)) <> 0 then raise exception 'FAIL 1: account should start empty'; end if;

  -- Signing in links my guest order (email matched, any capitals) — and only mine.
  if public.claim_orders_by_email(v_me) <> 1 then raise exception 'FAIL 2: my guest order was not linked'; end if;
  if public.claim_orders_by_email(v_unverified) <> 0 then raise exception 'FAIL 3: an unproved email must not link orders'; end if;

  -- I can reach my order, not someone else's.
  if public.customer_order_hash(v_order1, v_me) is distinct from v_hash1 then raise exception 'FAIL 4: cannot reach my order'; end if;
  if public.customer_order_hash(v_order2, v_me) is not null then raise exception 'FAIL 5: reached someone else''s order'; end if;
  if public.customer_order_hash(v_order1, v_unverified) is not null then raise exception 'FAIL 6: stranger reached my order'; end if;

  v_list := public.customer_orders(v_me);
  if jsonb_array_length(v_list) <> 1 or (v_list -> 0 ->> 'order_id')::uuid <> v_order1 then raise exception 'FAIL 7: my orders list is wrong'; end if;

  -- An order placed while signed in is linked with its private-link fingerprint only.
  if public.claim_order(v_order2, v_me, v_hash1) then raise exception 'FAIL 8: linked with the wrong fingerprint'; end if;
  if not public.claim_order(v_order2, v_me, v_hash2) then raise exception 'FAIL 9: could not link a new order'; end if;
  if public.claim_order(v_order2, v_unverified, v_hash2) then raise exception 'FAIL 10: an order was moved to another account'; end if;
  if jsonb_array_length(public.customer_orders(v_me)) <> 2 then raise exception 'FAIL 11: my orders list should have 2 orders'; end if;

  -- The old private link still works for both orders.
  if public.guest_order_details(v_order1, v_hash1) is null then raise exception 'FAIL 12: private link stopped working'; end if;

  -- The owner of an order still can't be changed outside these functions.
  begin
    update public.orders set customer_id = null where id = v_order1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL 13: order owner could be changed directly'; end if;

  -- Only our server may use the new functions.
  if has_function_privilege('anon', 'public.customer_orders(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.customer_orders(uuid)', 'execute')
     or has_function_privilege('anon', 'public.claim_orders_by_email(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.claim_order(uuid, uuid, text)', 'execute')
     or has_function_privilege('authenticated', 'public.customer_order_hash(uuid, uuid)', 'execute') then
    raise exception 'FAIL 14: visitors can call the new functions';
  end if;
  if not has_function_privilege('service_role', 'public.customer_orders(uuid)', 'execute') then
    raise exception 'FAIL 15: our server cannot call the new functions';
  end if;

  raise exception 'RSN TEST PASSED (everything was undone)';
end;
$$;

rollback;

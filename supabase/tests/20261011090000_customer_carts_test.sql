-- =====================================================================
-- TEST RUN for 20261011090000_customer_carts.sql — changes NOTHING.
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It installs the saved carts, makes a pretend customer, checks everything,
-- then deliberately stops with an error so the database UNDOES all of it.
--
--   Success looks like a red message:  RSN TEST PASSED (everything was undone)
--   Any other message means a check failed — nothing was saved either way.
-- =====================================================================

begin;
-- ---- 1. the migration, exactly as it will be applied ----
-- =====================================================================
-- RSN — saved carts: the same cart on the website AND the app
--
--   A signed-in customer's cart is saved to their account, so adding a
--   product on the website shows it in the app (and the other way round).
--   Guests keep their cart on the device only, as before.
--
--   The saved cart is for DISPLAY only — exactly like the cart kept on the
--   device. Checkout still takes every price from the catalogue.
--
--   1. customer_carts: one cart per account (nobody can read it directly).
--   2. get_customer_cart() / save_customer_cart(): used by our server only.
-- =====================================================================

create table public.customer_carts (
  customer_id uuid primary key references public.profiles (id) on delete cascade,
  lines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint customer_carts_lines_shape check (
    jsonb_typeof(lines) = 'array'
    and jsonb_array_length(lines) <= 50
    and pg_column_size(lines) <= 32768
  )
);

-- No direct access for visitors or signed-in users: only the functions below.
alter table public.customer_carts enable row level security;
revoke all on public.customer_carts from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- My saved cart: {"lines": [...], "updated_at": "..."} (empty if none yet).
-- ---------------------------------------------------------------------
create function public.get_customer_cart(p_customer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('lines', c.lines, 'updated_at', c.updated_at)
       from public.customer_carts c where c.customer_id = p_customer_id),
    jsonb_build_object('lines', '[]'::jsonb, 'updated_at', null)
  );
$$;

-- ---------------------------------------------------------------------
-- Save my cart (replaces the whole cart). Returns the time it was saved.
-- ---------------------------------------------------------------------
create function public.save_customer_cart(p_customer_id uuid, p_lines jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_at timestamptz := now();
begin
  select lower(u.email) into v_email from auth.users u where u.id = p_customer_id;
  if not found then
    raise exception 'RSN_NOT_FOUND: no such account';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'RSN_INVALID: the cart must be a list';
  end if;

  -- customer_carts points at profiles; make sure the profile exists.
  insert into public.profiles (id, email) values (p_customer_id, v_email)
    on conflict (id) do nothing;

  insert into public.customer_carts (customer_id, lines, updated_at)
    values (p_customer_id, p_lines, v_at)
    on conflict (customer_id) do update set lines = excluded.lines, updated_at = excluded.updated_at;

  return v_at;
end;
$$;

revoke execute on function
  public.get_customer_cart(uuid),
  public.save_customer_cart(uuid, jsonb)
from public, anon, authenticated;

grant execute on function
  public.get_customer_cart(uuid),
  public.save_customer_cart(uuid, jsonb)
to service_role;

-- ---- 2. the checks ----
do $$
declare
  v_me uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_cart jsonb;
  v_line jsonb := '{"productId":"00000000-0000-0000-0000-000000000001","slug":"test","name":"Test shoe","categoryName":"Shoes","priceKobo":100,"size":"42","quantity":2,"availability":null,"availabilityLabel":null}';
  v_blocked boolean := false;
begin
  insert into auth.users (id, email, email_confirmed_at, aud, role)
    values (v_me, 'rsn-cart-test-me@example.com', now(), 'authenticated', 'authenticated'),
           (v_other, 'rsn-cart-test-other@example.com', now(), 'authenticated', 'authenticated');

  -- A new account starts with an empty cart.
  v_cart := public.get_customer_cart(v_me);
  if jsonb_array_length(v_cart -> 'lines') <> 0 or v_cart ->> 'updated_at' is not null then raise exception 'FAIL 1: new cart should be empty'; end if;

  -- Saving and reading back.
  perform public.save_customer_cart(v_me, jsonb_build_array(v_line));
  v_cart := public.get_customer_cart(v_me);
  if jsonb_array_length(v_cart -> 'lines') <> 1 or (v_cart -> 'lines' -> 0 ->> 'quantity')::int <> 2 then raise exception 'FAIL 2: saved cart not read back'; end if;

  -- Saving again replaces the cart (e.g. after removing an item).
  perform public.save_customer_cart(v_me, '[]');
  if jsonb_array_length(public.get_customer_cart(v_me) -> 'lines') <> 0 then raise exception 'FAIL 3: cart was not replaced'; end if;

  -- Carts are separate per account.
  perform public.save_customer_cart(v_me, jsonb_build_array(v_line));
  if jsonb_array_length(public.get_customer_cart(v_other) -> 'lines') <> 0 then raise exception 'FAIL 4: saw someone else''s cart'; end if;

  -- Not a list, or too many lines: refused.
  begin
    perform public.save_customer_cart(v_me, '{"not":"a list"}');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL 5: a cart that is not a list was saved'; end if;
  v_blocked := false;
  begin
    perform public.save_customer_cart(v_me, (select jsonb_agg(v_line) from generate_series(1, 51)));
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL 6: a cart with 51 lines was saved'; end if;

  -- Only our server may use the carts.
  if has_table_privilege('anon', 'public.customer_carts', 'select')
     or has_table_privilege('authenticated', 'public.customer_carts', 'select')
     or has_table_privilege('authenticated', 'public.customer_carts', 'update')
     or has_function_privilege('anon', 'public.get_customer_cart(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.save_customer_cart(uuid, jsonb)', 'execute') then
    raise exception 'FAIL 7: visitors can reach the saved carts';
  end if;
  if not has_function_privilege('service_role', 'public.save_customer_cart(uuid, jsonb)', 'execute') then
    raise exception 'FAIL 8: our server cannot save carts';
  end if;

  raise exception 'RSN TEST PASSED (everything was undone)';
end;
$$;

rollback;

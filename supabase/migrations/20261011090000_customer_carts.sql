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

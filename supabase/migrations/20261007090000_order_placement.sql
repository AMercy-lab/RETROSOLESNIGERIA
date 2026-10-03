-- =====================================================================
-- RSN — order placement + cancel-before-payment (tested on a copy of the live database before release)
--
--   1. place_order(): the ONLY way to create an order. Our server sends
--      products, sizes, quantities and delivery details; the database looks
--      up every price, name and availability itself, checks sizes and
--      quantities, and creates the order and its items together.
--      Only our server (secret key) may call it.
--   2. Customers may cancel their own order any time BEFORE paying —
--      now also after RSN has confirmed it. Cancelling also cancels the
--      confirmation, so a payment started earlier can never mark a
--      cancelled order as paid (it is recorded for refund review instead).
-- =====================================================================

create function public.place_order(
  p_customer_id uuid,            -- signed-in customer, or null for a guest
  p_guest_token_hash text,       -- SHA-256 of a guest's private link secret, or null
  p_payment_method public.payment_method,  -- the customer's preferred way to pay later
  p_delivery jsonb,              -- {"name","email","phone","address","city","state"}
  p_items jsonb                  -- [{"product_id": "...", "size": "42" | null, "quantity": 2}, ...]
)
returns table (order_id uuid, order_number text, confirmation_due_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_delivery ->> 'name', ''));
  v_email text := lower(btrim(coalesce(p_delivery ->> 'email', '')));
  v_phone text := btrim(coalesce(p_delivery ->> 'phone', ''));
  v_address text := btrim(coalesce(p_delivery ->> 'address', ''));
  v_city text := btrim(coalesce(p_delivery ->> 'city', ''));
  v_state text := btrim(coalesce(p_delivery ->> 'state', ''));
  v_item jsonb;
  v_product public.products;
  v_size text;
  v_quantity integer;
  v_subtotal bigint := 0;
  v_order public.orders;
  v_seen text[] := '{}';
  v_key text;
begin
  -- Who the order belongs to: exactly one of an account or a guest link
  if (p_customer_id is null) = (p_guest_token_hash is null) then
    raise exception 'RSN_INVALID: an order needs either a customer account or a guest link';
  end if;
  if p_guest_token_hash is not null and p_guest_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'RSN_INVALID: guest link fingerprint is malformed';
  end if;
  if p_payment_method is null then
    raise exception 'RSN_INVALID: payment method is required';
  end if;

  -- Delivery details
  if v_name = '' or v_phone = '' or v_address = '' or v_city = '' or v_state = '' or v_email = '' then
    raise exception 'RSN_INVALID: name, phone, email, address, city and state are all required';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'RSN_INVALID: email address looks wrong';
  end if;
  if length(v_name) > 120 or length(v_email) > 200 or length(v_phone) > 30
     or length(v_address) > 300 or length(v_city) > 100 or length(v_state) > 60 then
    raise exception 'RSN_INVALID: a delivery detail is too long';
  end if;

  -- Items
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'RSN_INVALID: an order needs between 1 and 50 items';
  end if;

  insert into public.orders
    (customer_id, guest_access_token_hash, subtotal_kobo, delivery_fee_kobo, total_kobo, payment_method,
     delivery_name, delivery_email, delivery_phone, delivery_address_line1, delivery_city, delivery_state)
  values
    (p_customer_id, p_guest_token_hash, 0, 0, 0, p_payment_method,
     v_name, v_email, v_phone, v_address, v_city, v_state)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item ->> 'product_id')::uuid and is_active;
    if not found then
      raise exception 'RSN_UNAVAILABLE: a product in the cart is no longer available';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 10 then
      raise exception 'RSN_INVALID: quantity must be between 1 and 10';
    end if;

    v_size := nullif(btrim(coalesce(v_item ->> 'size', '')), '');
    if cardinality(v_product.sizes) > 0 then
      if v_size is null or not (v_size = any (v_product.sizes)) then
        raise exception 'RSN_SIZE: % needs a valid size', v_product.name;
      end if;
    elsif v_size is not null then
      raise exception 'RSN_SIZE: % has no sizes', v_product.name;
    end if;

    v_key := v_product.id::text || '::' || coalesce(v_size, '');
    if v_key = any (v_seen) then
      raise exception 'RSN_INVALID: the same product and size appears twice';
    end if;
    v_seen := v_seen || v_key;

    -- Price, name and availability always come from the database.
    insert into public.order_items
      (order_id, product_id, product_name, unit_price_kobo, quantity, size, availability_at_order)
    values
      (v_order.id, v_product.id, v_product.name, v_product.price_kobo, v_quantity, v_size, v_product.availability);

    v_subtotal := v_subtotal + v_product.price_kobo * v_quantity;
  end loop;

  -- Items-only estimate; the delivery fee stays a 0 placeholder until RSN confirms.
  perform set_config('rsn.trusted_change', 'on', true);
  update public.orders set subtotal_kobo = v_subtotal, total_kobo = v_subtotal where id = v_order.id;
  perform set_config('rsn.trusted_change', 'off', true);

  return query select v_order.id, v_order.order_number, v_order.confirmation_due_at;
end;
$$;

revoke execute on function public.place_order(uuid, text, public.payment_method, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.place_order(uuid, text, public.payment_method, jsonb, jsonb)
  to service_role;

-- ---------------------------------------------------------------------
-- Cancel any time before payment (also after RSN confirms).
-- Not possible once a payment is being verified or has been confirmed.
-- ---------------------------------------------------------------------
create or replace function public.apply_customer_cancellation(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.fulfilment_status = 'cancelled' then
    raise exception 'This order is already cancelled';
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') then
    raise exception 'This order has a payment being verified or already paid, so it can no longer be cancelled here. Please contact RSN.';
  end if;
  if o.supplier_confirmation_status = 'unavailable' then
    raise exception 'This order is already closed';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  -- The confirmation can no longer be paid (a late payment is recorded for refund review).
  update public.order_confirmations set state = 'cancelled'
    where order_id = p_order_id and state in ('active', 'expired');
  update public.orders
    set fulfilment_status = 'cancelled',
        customer_decided_at = now()
    where id = p_order_id;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

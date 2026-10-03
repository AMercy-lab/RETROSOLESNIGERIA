-- =====================================================================
-- RSN — guest order access through the private order link (tested on a copy of the live database before release)
--
-- A guest's private link carries a secret; only its SHA-256 fingerprint is
-- stored on the order. These actions only work when that fingerprint
-- matches, so even our own server cannot show or change a guest's order
-- without the secret from the customer's link. Only our server (secret
-- key) may call them. No table permissions are granted.
--
--   guest_order_details()              customer-safe details of ONE order
--   guest_cancel_order()               cancel before payment
--   guest_decide_on_unavailable_items() "continue without" / "cancel"
--
-- The 0 delivery-fee placeholder is never returned: a delivery fee and
-- total only appear once RSN has confirmed the order.
-- =====================================================================

-- Customer-safe details of one order, or NULL when the link doesn't match.
create function public.guest_order_details(p_order_id uuid, p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
  c public.order_confirmations;
  v_open boolean;
begin
  if p_order_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into o from public.orders
    where id = p_order_id and guest_access_token_hash = p_token_hash;
  if not found then
    return null;
  end if;

  select * into c from public.order_confirmations where order_id = o.id and state = 'active';
  select w.is_open into v_open from public.payment_window_for_order(o.id) w;

  return jsonb_build_object(
    'order_id', o.id,
    'order_number', o.order_number,
    'placed_at', o.created_at,
    'supplier_confirmation_status', o.supplier_confirmation_status,
    'payment_status', o.payment_status,
    'fulfilment_status', o.fulfilment_status,
    'payment_method', o.payment_method,
    'confirmation_due_at', o.confirmation_due_at,
    'customer_decided_at', o.customer_decided_at,
    'delivery', jsonb_build_object(
      'name', o.delivery_name, 'email', o.delivery_email, 'phone', o.delivery_phone,
      'address', o.delivery_address_line1, 'city', o.delivery_city, 'state', o.delivery_state
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'name', i.product_name,
        'size', i.size,
        'quantity', i.quantity,
        'unit_price_kobo', i.unit_price_kobo,
        'availability_at_order', i.availability_at_order,
        'supplier_status', i.supplier_status,
        'supplier_note', i.supplier_note,
        'excluded', i.excluded,
        'confirmed_unit_price_kobo', ci.unit_price_kobo
      ) order by i.product_name), '[]'::jsonb)
      from public.order_items i
      left join public.order_confirmation_items ci
        on ci.order_item_id = i.id and ci.confirmation_id = c.id
      where i.order_id = o.id
    ),
    -- Only RSN's confirmed amounts; null until RSN confirms.
    'confirmation', case when c.id is null then null else jsonb_build_object(
      'confirmed_at', c.confirmed_at,
      'payment_due_at', c.payment_due_at,
      'subtotal_kobo', c.subtotal_kobo,
      'delivery_fee_kobo', c.delivery_fee_kobo,
      'total_kobo', c.total_kobo
    ) end,
    'payment_open', coalesce(v_open, false)
  );
end;
$$;

-- Cancel before payment, only with the matching private link.
create function public.guest_cancel_order(p_order_id uuid, p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or not exists (select 1 from public.orders where id = p_order_id and guest_access_token_hash = p_token_hash) then
    raise exception 'RSN_NOT_FOUND: order not found';
  end if;
  perform public.apply_customer_cancellation(p_order_id);
end;
$$;

-- "Continue without" / "cancel" for partly-unavailable orders, only with the matching private link.
create function public.guest_decide_on_unavailable_items(p_order_id uuid, p_token_hash text, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or not exists (select 1 from public.orders where id = p_order_id and guest_access_token_hash = p_token_hash) then
    raise exception 'RSN_NOT_FOUND: order not found';
  end if;
  perform public.apply_unavailable_items_decision(p_order_id, p_decision);
end;
$$;

revoke execute on function
  public.guest_order_details(uuid, text),
  public.guest_cancel_order(uuid, text),
  public.guest_decide_on_unavailable_items(uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.guest_order_details(uuid, text),
  public.guest_cancel_order(uuid, text),
  public.guest_decide_on_unavailable_items(uuid, text, text)
to service_role;

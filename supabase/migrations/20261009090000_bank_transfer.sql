-- =====================================================================
-- RSN — bank-transfer payments for guest orders (tested on a copy of the live database before release)
--
--   guest_start_bank_transfer()     start (or reuse) a bank-transfer payment
--                                   for the order's ACTIVE confirmation, for
--                                   exactly its confirmed total
--   guest_submit_transfer_proof()   attach the uploaded receipt; the payment
--                                   becomes "awaiting verification" (NEVER
--                                   confirmed — only RSN can confirm)
--   guest_order_details()           now also returns the latest payment's
--                                   status and RSN's reason if it was rejected
--
-- Each works only when the private link's secret matches the order, and only
-- our server (secret key) may call them. Deadlines, amounts and statuses are
-- still enforced by the existing payment rules and triggers.
-- =====================================================================

create function public.guest_start_bank_transfer(p_order_id uuid, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
  v_payment_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or not exists (select 1 from public.orders where id = p_order_id and guest_access_token_hash = p_token_hash) then
    raise exception 'RSN_NOT_FOUND: order not found';
  end if;

  select * into w from public.payment_window_for_order(p_order_id);
  if not w.is_open then
    raise exception 'RSN_PAYMENT_CLOSED: payment is not open for this order';
  end if;

  -- Reuse a pending bank-transfer payment for this same confirmation (e.g. a retry).
  select id into v_payment_id from public.payments
    where order_id = p_order_id and method = 'bank_transfer'
      and order_confirmation_id = w.confirmation_id and status = 'pending'
    order by created_at desc limit 1;
  if v_payment_id is not null then
    return v_payment_id;
  end if;

  insert into public.payments (order_id, method, amount_kobo, order_confirmation_id)
    values (p_order_id, 'bank_transfer', w.amount_kobo, w.confirmation_id)
    returning id into v_payment_id;
  return v_payment_id;
end;
$$;

create function public.guest_submit_transfer_proof(
  p_order_id uuid,
  p_token_hash text,
  p_payment_id uuid,
  p_storage_path text,
  p_note text
)
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
  if not exists (select 1 from public.payments
                 where id = p_payment_id and order_id = p_order_id and method = 'bank_transfer') then
    raise exception 'RSN_NOT_FOUND: payment not found';
  end if;
  -- Receipts for guest orders live in their own folder of the private bucket.
  if p_storage_path is null or p_storage_path not like ('guest/' || p_order_id::text || '/%') then
    raise exception 'RSN_INVALID: receipt location is not allowed';
  end if;

  -- The existing triggers check the 1-hour window and mark the payment
  -- (and the order) "awaiting verification".
  insert into public.payment_proofs (payment_id, uploaded_by, storage_path, customer_note)
    values (p_payment_id, null, p_storage_path, nullif(left(btrim(coalesce(p_note, '')), 500), ''));
end;
$$;

-- Same as before, plus the latest payment (status + RSN's reason if rejected).
create or replace function public.guest_order_details(p_order_id uuid, p_token_hash text)
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
    'confirmation', case when c.id is null then null else jsonb_build_object(
      'confirmed_at', c.confirmed_at,
      'payment_due_at', c.payment_due_at,
      'subtotal_kobo', c.subtotal_kobo,
      'delivery_fee_kobo', c.delivery_fee_kobo,
      'total_kobo', c.total_kobo
    ) end,
    'payment_open', coalesce(v_open, false),
    'latest_payment', (
      select jsonb_build_object(
        'method', p.method,
        'status', p.status,
        'rejection_reason', p.rejection_reason,
        'has_proof', exists (select 1 from public.payment_proofs pp where pp.payment_id = p.id),
        'created_at', p.created_at
      )
      from public.payments p
      where p.order_id = o.id
      order by p.created_at desc
      limit 1
    )
  );
end;
$$;

revoke execute on function
  public.guest_start_bank_transfer(uuid, text),
  public.guest_submit_transfer_proof(uuid, text, uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.guest_start_bank_transfer(uuid, text),
  public.guest_submit_transfer_proof(uuid, text, uuid, text, text)
to service_role;

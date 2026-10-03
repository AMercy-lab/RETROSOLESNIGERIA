-- =====================================================================
-- RSN — checkout corrections (tested on a copy of the live database before release)
--
-- Business rule: "Available", "Confirm to purchase" and "Subject to
-- availability" ALL need RSN/supplier confirmation before payment.
--
--   1. Every new order starts "awaiting RSN confirmation" (no payable
--      "not required" path).
--   2. A new order can't start paid, processing, shipped, delivered or
--      cancelled, and can't carry a delivery fee (RSN sets it on confirming).
--   3. Confirmations can only be created through "Confirm Order".
--   4. A payment's order, method and Paystack reference are protected.
--   5. A late Paystack payment is permanently recorded as
--      "received_late_needs_review".
--   6. The old store-wide flat delivery fee setting is removed.
--   7. "Continue without" gives RSN a FRESH 3-hour window; the decision
--      time is recorded.
--   8. A customer can cancel their own order while RSN is still confirming
--      it (signed-in customers directly; guests through our server).
--
-- Delivery fee: a new order holds 0 as a PLACEHOLDER only. Payment can never
-- open until RSN's "Confirm Order" records the actual delivery fee (which may
-- legitimately be 0) together with supplier availability and the final total.
--
-- Catalogue, availability, sign-in, storage and existing security rules
-- are not changed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 5a. New payment status (used only on payment records, never on orders)
--     Kept first: a new status value must exist before functions mention it.
-- ---------------------------------------------------------------------
alter type public.payment_status add value if not exists 'received_late_needs_review';

-- ---------------------------------------------------------------------
-- 1 + 2. New orders: always "awaiting RSN confirmation", nothing paid,
--        nothing shipped, no delivery fee yet.
-- ---------------------------------------------------------------------
alter table public.orders
  alter column supplier_confirmation_status set default 'awaiting_confirmation',
  add column customer_decided_at timestamptz,  -- when the customer chose "continue without" / "cancel"
  -- "not_required" stays in the status list (PostgreSQL can't remove list values)
  -- but no order may ever use it.
  add constraint orders_confirmation_always_required
    check (supplier_confirmation_status <> 'not_required');

-- Same trigger and name as before; the rules are now stricter.
create or replace function public.set_order_confirmation_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supplier_confirmation_status is distinct from 'awaiting_confirmation' then
    raise exception 'Every new order must start as awaiting_confirmation: RSN confirms all orders before payment';
  end if;
  if new.payment_status is distinct from 'pending' then
    raise exception 'A new order must start with payment pending';
  end if;
  if new.fulfilment_status is distinct from 'pending' then
    raise exception 'A new order must start with fulfilment pending';
  end if;
  if new.delivery_fee_kobo is distinct from 0 then
    raise exception 'The delivery fee is set by RSN when confirming the order, not when it is placed';
  end if;
  new.confirmation_due_at := now() + public.rsn_confirmation_window();
  new.customer_decided_at := null;
  return new;
end;
$$;

-- Payment is only ever possible against an ACTIVE confirmation, inside its hour.
-- (The old "not required" shortcut is removed.)
create or replace function public.payment_window_for_order(
  p_order_id uuid,
  out is_open boolean,
  out confirmation_id uuid,
  out amount_kobo bigint,
  out due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  o public.orders;
  c public.order_confirmations;
begin
  is_open := false;
  select * into o from public.orders where id = p_order_id;
  if not found
     or o.payment_status not in ('pending', 'failed', 'rejected')
     or o.fulfilment_status = 'cancelled'
     or o.supplier_confirmation_status <> 'confirmed' then
    return;
  end if;

  select * into c from public.order_confirmations where order_id = p_order_id and state = 'active';
  if not found or now() > c.payment_due_at then
    return;
  end if;

  is_open := true;
  confirmation_id := c.id;
  amount_kobo := c.total_kobo;
  due_at := c.payment_due_at;
end;
$$;

-- Every payment must belong to a confirmation.
alter table public.payments alter column order_confirmation_id set not null;

-- ---------------------------------------------------------------------
-- 3. Confirmations and their price lines: only created/removed inside
--    RSN's functions (e.g. "Confirm Order"), never by direct writes.
-- ---------------------------------------------------------------------
create function public.guard_confirmation_writes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('rsn.trusted_change', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'Confirmations can only be created or changed through RSN''s Confirm Order action'
    using errcode = '42501';
end;
$$;

create trigger order_confirmations_write_guard
  before insert or delete on public.order_confirmations
  for each row execute function public.guard_confirmation_writes();
create trigger order_confirmation_items_write_guard
  before insert or update or delete on public.order_confirmation_items
  for each row execute function public.guard_confirmation_writes();

-- Second lock: the server role has no direct write access to these tables at all.
revoke insert, update, delete on public.order_confirmations, public.order_confirmation_items from service_role;

revoke execute on function public.guard_confirmation_writes() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 + 7. Safety net updated: also protects a payment's order, method and
--        Paystack reference (once set), and the customer's decision time.
-- ---------------------------------------------------------------------
create or replace function public.guard_checkout_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('rsn.trusted_change', true), '') = 'on' then
    return new;
  end if;

  -- (Separate IF blocks per table: each table's fields only exist on that table.)
  if tg_table_name = 'orders' then
    if new.payment_status is distinct from old.payment_status
       or new.supplier_confirmation_status is distinct from old.supplier_confirmation_status
       or new.confirmation_due_at is distinct from old.confirmation_due_at
       or new.customer_decided_at is distinct from old.customer_decided_at
       or new.subtotal_kobo is distinct from old.subtotal_kobo
       or new.delivery_fee_kobo is distinct from old.delivery_fee_kobo
       or new.total_kobo is distinct from old.total_kobo
       or new.customer_id is distinct from old.customer_id
       or new.guest_access_token_hash is distinct from old.guest_access_token_hash then
      raise exception 'Payment, confirmation and amounts can only be changed through RSN checkout functions'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'order_items' then
    if new.unit_price_kobo is distinct from old.unit_price_kobo
       or new.quantity is distinct from old.quantity
       or new.supplier_status is distinct from old.supplier_status
       or new.excluded is distinct from old.excluded then
      raise exception 'Order items can only be changed through RSN checkout functions'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'payments' then
    if new.status is distinct from old.status
       or new.order_id is distinct from old.order_id
       or new.method is distinct from old.method
       or new.amount_kobo is distinct from old.amount_kobo
       or new.order_confirmation_id is distinct from old.order_confirmation_id
       or new.paid_at is distinct from old.paid_at
       or new.amount_received_kobo is distinct from old.amount_received_kobo
       or new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by
       -- the Paystack reference may be set once, when the payment starts, never changed
       or (old.paystack_reference is not null
           and new.paystack_reference is distinct from old.paystack_reference) then
      raise exception 'Payments can only be changed through RSN checkout functions'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'order_confirmations' then
    raise exception 'Confirmations can only be changed through RSN checkout functions'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5b. Paystack: a late payment (after the 1-hour deadline, or against a
--     replaced/cancelled confirmation) is stored permanently as
--     "received_late_needs_review" with the time and amount received.
--     The order is NOT marked paid. RSN reviews it (refund or reconfirm).
-- ---------------------------------------------------------------------
create or replace function public.record_paystack_payment(
  p_reference text,
  p_amount_kobo bigint,
  p_paid_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  c public.order_confirmations;
begin
  select * into p from public.payments where paystack_reference = p_reference for update;
  if not found or p.method <> 'paystack' then
    raise exception 'Unknown Paystack payment';
  end if;
  if p.status = 'confirmed' then
    return 'already_confirmed';
  end if;
  if p.status::text = 'received_late_needs_review' then
    return 'late_needs_review';  -- repeated notice from Paystack: nothing changes
  end if;
  if p.status <> 'pending' then
    raise exception 'This payment is not pending';
  end if;
  if p_amount_kobo <> p.amount_kobo then
    raise exception 'Paystack amount does not match the confirmed total';
  end if;

  select * into c from public.order_confirmations where id = p.order_confirmation_id for update;
  if c.state not in ('active', 'expired') or p_paid_at > c.payment_due_at then
    perform set_config('rsn.trusted_change', 'on', true);
    update public.payments
      set status = 'received_late_needs_review'::text::public.payment_status,
          paid_at = p_paid_at,
          amount_received_kobo = p_amount_kobo,
          verified_at = now(),
          rejection_reason = 'Paid after the payment deadline or against a replaced confirmation: refund or review'
      where id = p.id;
    perform set_config('rsn.trusted_change', 'off', true);
    return 'late_needs_review';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.payments
    set status = 'confirmed', paid_at = p_paid_at, amount_received_kobo = p_amount_kobo, verified_at = now()
    where id = p.id;
  update public.orders
    set payment_status = 'confirmed',
        supplier_confirmation_status = 'confirmed',
        fulfilment_status = 'processing'
    where id = p.order_id;
  update public.order_confirmations set state = 'paid' where id = p.order_confirmation_id;
  perform set_config('rsn.trusted_change', 'off', true);
  return 'confirmed';
end;
$$;

-- ---------------------------------------------------------------------
-- 7. "Continue without": unavailable items stay on record (excluded), the
--    order goes back to RSN with a FRESH 3-hour window, and the decision
--    time is recorded. "Cancel" is recorded the same way.
-- ---------------------------------------------------------------------
create or replace function public.apply_unavailable_items_decision(p_order_id uuid, p_decision text)
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
  if o.supplier_confirmation_status <> 'awaiting_customer_decision' then
    raise exception 'This order is not waiting for a customer decision';
  end if;
  if p_decision not in ('continue', 'cancel') then
    raise exception 'Decision must be continue or cancel';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  if p_decision = 'continue' then
    update public.order_items set excluded = true
      where order_id = p_order_id and supplier_status = 'unavailable';
    update public.orders
      set supplier_confirmation_status = 'awaiting_confirmation',
          confirmation_due_at = now() + public.rsn_confirmation_window(),  -- fresh 3 hours for RSN
          customer_decided_at = now()
      where id = p_order_id;
  else
    update public.orders
      set fulfilment_status = 'cancelled',
          customer_decided_at = now()
      where id = p_order_id;
  end if;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Remove the store-wide flat delivery fee (fees are per order, on the
--    confirmation). Its live value is 0 and nothing uses it.
-- ---------------------------------------------------------------------
alter table public.store_settings drop column delivery_fee_kobo;


-- ---------------------------------------------------------------------
-- 8. Customer cancellation while RSN is still confirming the order.
--    Allowed only before RSN has confirmed it and before any payment is
--    being verified or confirmed. Nothing is deleted: the order is marked
--    cancelled and the time is recorded.
-- ---------------------------------------------------------------------

-- The shared logic (not callable directly by anyone).
create function public.apply_customer_cancellation(p_order_id uuid)
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
  if o.supplier_confirmation_status not in
       ('awaiting_confirmation', 'confirmation_expired', 'awaiting_customer_decision') then
    raise exception 'RSN has already confirmed this order, so it can no longer be cancelled here. Please contact RSN.';
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') then
    raise exception 'This order already has a payment being verified or paid';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.orders
    set fulfilment_status = 'cancelled',
        customer_decided_at = now()
    where id = p_order_id;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- Signed-in customer: their own order only. (Admins use admin_cancel_unpaid_order.)
create function public.cancel_my_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.orders
                 where id = p_order_id and customer_id is not null and customer_id = auth.uid()) then
    raise exception 'You cannot cancel this order' using errcode = '42501';
  end if;
  perform public.apply_customer_cancellation(p_order_id);
end;
$$;

-- Our server, after checking a guest's private order link.
create function public.server_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_customer_cancellation(p_order_id);
end;
$$;

revoke execute on function
  public.apply_customer_cancellation(uuid),
  public.cancel_my_order(uuid),
  public.server_cancel_order(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_my_order(uuid) to authenticated;
grant execute on function public.server_cancel_order(uuid) to service_role;

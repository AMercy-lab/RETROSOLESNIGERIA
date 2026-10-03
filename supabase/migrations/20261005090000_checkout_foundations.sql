-- =====================================================================
-- RSN — checkout foundations (approved design; tested 78/78 before release)
--
--   * supplier confirmation, kept separate from payment and fulfilment
--   * per-item supplier availability, incl. partly-unavailable orders
--   * two FIXED, separate timers:
--       RSN confirmation deadline = order placed + 3 hours
--       customer payment deadline = "Confirm Order" clicked + 1 hour
--   * confirmation records: confirmed prices + delivery fee = locked total
--   * guest orders (no account needed)
--   * money and status changes only through named database functions
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Fixed business rules (changing them requires a new migration,
--    so they can't be edited from the dashboard or the website)
-- ---------------------------------------------------------------------
create function public.rsn_confirmation_window()
returns interval language sql immutable as $$ select interval '3 hours' $$;

create function public.rsn_payment_window()
returns interval language sql immutable as $$ select interval '1 hour' $$;

-- ---------------------------------------------------------------------
-- 2. New status lists
-- ---------------------------------------------------------------------
-- Order-level supplier confirmation (separate from payment and fulfilment)
create type public.supplier_confirmation_status as enum (
  'not_required',                -- every item was "Available": normal checkout
  'awaiting_confirmation',       -- "Awaiting RSN confirmation" (RSN's 3-hour window)
  'awaiting_customer_decision',  -- some items unavailable: customer must choose before payment
  'confirmation_expired',        -- RSN's 3 hours passed: needs action (confirm late or cancel)
  'confirmed',                   -- availability + delivery fee + final amount all confirmed: customer may pay
  'payment_window_expired',      -- customer didn't pay within 1 hour: RSN must reconfirm
  'unavailable'                  -- nothing could be supplied: order cancelled, nothing paid
);

-- Per-item result of RSN's supplier check
create type public.item_supplier_status as enum ('pending', 'available', 'unavailable');

-- State of each confirmation record
create type public.order_confirmation_state as enum (
  'active',      -- the only one the customer can pay against (and only before its deadline)
  'expired',     -- its 1-hour payment window passed
  'superseded',  -- replaced by a newer confirmation
  'paid',        -- payment confirmed against it
  'cancelled'    -- order marked unavailable or cancelled
);

-- ---------------------------------------------------------------------
-- 3. Orders: guest orders + supplier confirmation + RSN's 3-hour deadline
-- ---------------------------------------------------------------------
alter table public.orders
  alter column customer_id drop not null,
  -- Guests get a private order link; only a SHA-256 fingerprint of its secret is stored.
  add column guest_access_token_hash text unique,
  add column supplier_confirmation_status public.supplier_confirmation_status not null default 'not_required',
  add column confirmation_due_at timestamptz,  -- set automatically: placed + 3 hours
  add constraint orders_has_owner
    check (customer_id is not null or guest_access_token_hash is not null),
  add constraint orders_awaiting_has_deadline
    check (supplier_confirmation_status <> 'awaiting_confirmation' or confirmation_due_at is not null),
  -- Money can only be taken once RSN has confirmed (or no confirmation was needed).
  add constraint orders_payment_requires_supplier_confirmation check (
    payment_status in ('pending', 'failed', 'rejected')
    or supplier_confirmation_status in ('not_required', 'confirmed')
  );

create index orders_supplier_confirmation_idx
  on public.orders (supplier_confirmation_status, confirmation_due_at);

-- The 3-hour deadline is set by the database clock, never by the caller.
create function public.set_order_confirmation_deadline()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supplier_confirmation_status = 'awaiting_confirmation' then
    new.confirmation_due_at := now() + public.rsn_confirmation_window();
  elsif new.supplier_confirmation_status = 'not_required' then
    new.confirmation_due_at := null;
  else
    raise exception 'A new order must start as not_required or awaiting_confirmation';
  end if;
  return new;
end;
$$;

create trigger orders_set_confirmation_deadline
  before insert on public.orders
  for each row execute function public.set_order_confirmation_deadline();

-- ---------------------------------------------------------------------
-- 4. Order items: size, availability shown at ordering, and RSN's per-item
--    supplier result. Unavailable items are NEVER deleted: if the customer
--    continues without them they are only marked "excluded".
-- ---------------------------------------------------------------------
alter table public.order_items
  add column size text,
  add column availability_at_order public.product_availability not null default 'available',
  add column supplier_status public.item_supplier_status not null default 'pending',
  add column supplier_note text,             -- e.g. "Size 43 sold out at supplier"
  add column excluded boolean not null default false,  -- customer chose to continue without it
  add constraint order_items_only_unavailable_excluded
    check (not excluded or supplier_status = 'unavailable');
alter table public.order_items alter column availability_at_order drop default;

-- ---------------------------------------------------------------------
-- 5. Confirmation records — one row each time RSN clicks "Confirm Order".
--    total = confirmed product prices + confirmed delivery fee, nothing else.
-- ---------------------------------------------------------------------
create table public.order_confirmations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz not null default now(),
  payment_due_at timestamptz not null,  -- confirmed_at + 1 hour
  subtotal_kobo bigint not null check (subtotal_kobo >= 0),       -- sum of confirmed item prices
  delivery_fee_kobo bigint not null check (delivery_fee_kobo >= 0),
  total_kobo bigint not null check (total_kobo = subtotal_kobo + delivery_fee_kobo),
  state public.order_confirmation_state not null default 'active',
  created_at timestamptz not null default now(),
  check (payment_due_at > confirmed_at)
);

create index order_confirmations_order_id_idx on public.order_confirmations (order_id);
-- At most ONE active confirmation per order.
create unique index order_confirmations_one_active
  on public.order_confirmations (order_id) where state = 'active';

-- The confirmed price of each item in that confirmation
create table public.order_confirmation_items (
  confirmation_id uuid not null references public.order_confirmations (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  unit_price_kobo bigint not null check (unit_price_kobo >= 0),
  quantity integer not null check (quantity > 0),
  line_total_kobo bigint generated always as (unit_price_kobo * quantity) stored,
  primary key (confirmation_id, order_item_id)
);

-- ---------------------------------------------------------------------
-- 6. Payments: tied to one confirmation; bank transfers record the amount
--    RSN actually saw arrive. Proofs may come from guests.
-- ---------------------------------------------------------------------
alter table public.payments
  add column order_confirmation_id uuid references public.order_confirmations (id) on delete restrict,
  add column paid_at timestamptz,               -- when Paystack says the customer paid
  add column amount_received_kobo bigint;       -- bank transfer: amount RSN saw in the bank

create index payments_order_confirmation_id_idx on public.payments (order_confirmation_id);

alter table public.payment_proofs alter column uploaded_by drop not null;  -- guests have no account

-- ---------------------------------------------------------------------
-- 7. Safety net: payment status, confirmation status, amounts and item
--    availability can only change inside the RSN functions below.
--    Even admin dashboard code can't skip the rules by editing rows directly.
-- ---------------------------------------------------------------------
create function public.guard_checkout_fields()
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
       or new.amount_kobo is distinct from old.amount_kobo
       or new.order_confirmation_id is distinct from old.order_confirmation_id
       or new.paid_at is distinct from old.paid_at
       or new.amount_received_kobo is distinct from old.amount_received_kobo
       or new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by then
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

create trigger orders_guard_checkout_fields
  before update on public.orders
  for each row execute function public.guard_checkout_fields();
create trigger order_items_guard_checkout_fields
  before update on public.order_items
  for each row execute function public.guard_checkout_fields();
create trigger payments_guard_checkout_fields
  before update on public.payments
  for each row execute function public.guard_checkout_fields();
create trigger order_confirmations_guard
  before update on public.order_confirmations
  for each row execute function public.guard_checkout_fields();

-- ---------------------------------------------------------------------
-- 8. Is payment allowed right now, and for exactly how much?
--    (the single rule every payment path uses)
-- ---------------------------------------------------------------------
create function public.payment_window_for_order(
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
     or o.fulfilment_status = 'cancelled' then
    return;
  end if;

  if o.supplier_confirmation_status = 'not_required' then
    is_open := true;
    amount_kobo := o.total_kobo;
    return;
  end if;

  -- Needs an ACTIVE confirmation that is still inside its 1-hour window.
  select * into c from public.order_confirmations where order_id = p_order_id and state = 'active';
  if not found or o.supplier_confirmation_status <> 'confirmed' or now() > c.payment_due_at then
    return;
  end if;

  is_open := true;
  confirmation_id := c.id;
  amount_kobo := c.total_kobo;
  due_at := c.payment_due_at;
end;
$$;

-- A payment attempt (Paystack or bank transfer) can only be created while the
-- window is open, against the active confirmation, for exactly its total.
create function public.check_new_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
begin
  select * into w from public.payment_window_for_order(new.order_id);
  if not w.is_open then
    raise exception 'Payment is not open for this order (not yet confirmed by RSN, deadline passed, or already paid)';
  end if;
  if new.order_confirmation_id is distinct from w.confirmation_id then
    raise exception 'Payment must be made against the current RSN confirmation';
  end if;
  if new.amount_kobo <> w.amount_kobo then
    raise exception 'Payment amount does not match the confirmed total';
  end if;
  new.status := 'pending';
  new.paid_at := null;
  new.amount_received_kobo := null;
  new.verified_at := null;
  new.verified_by := null;
  return new;
end;
$$;

create trigger payments_check_new_payment
  before insert on public.payments
  for each row execute function public.check_new_payment();

-- A bank-transfer proof can only be uploaded while the payment window is open.
create function public.check_new_payment_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  w record;
begin
  select * into p from public.payments where id = new.payment_id for update;
  if not found or p.method <> 'bank_transfer' or p.status <> 'pending' then
    raise exception 'A proof can only be added to a pending bank-transfer payment';
  end if;
  select * into w from public.payment_window_for_order(p.order_id);
  if not w.is_open or w.confirmation_id is distinct from p.order_confirmation_id then
    raise exception 'The payment deadline for this order has passed';
  end if;
  return new;
end;
$$;

create trigger payment_proofs_check_new
  before insert on public.payment_proofs
  for each row execute function public.check_new_payment_proof();

-- After a proof is saved: payment -> "Awaiting Payment Verification" (never "Confirmed").
create function public.mark_payment_awaiting_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  perform set_config('rsn.trusted_change', 'on', true);
  update public.payments set status = 'awaiting_verification'
    where id = new.payment_id
    returning order_id into v_order_id;
  update public.orders set payment_status = 'awaiting_verification' where id = v_order_id;
  perform set_config('rsn.trusted_change', 'off', true);
  return new;
end;
$$;

create trigger payment_proofs_mark_awaiting_verification
  after insert on public.payment_proofs
  for each row execute function public.mark_payment_awaiting_verification();

-- ---------------------------------------------------------------------
-- 9. Admin actions (each checks is_admin() itself)
-- ---------------------------------------------------------------------

-- Supplier says one or more items are unavailable.
--  * every item unavailable -> order "unavailable", cancelled (nothing paid)
--  * only some              -> order "awaiting customer decision" (no payment possible)
-- Items are kept, never deleted.
create function public.admin_report_unavailable_items(
  p_order_id uuid,
  p_item_ids uuid[],
  p_note text
)
returns public.supplier_confirmation_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_updated integer;
  v_remaining integer;
  v_new public.supplier_confirmation_status;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can do this' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.supplier_confirmation_status not in
       ('awaiting_confirmation', 'confirmation_expired', 'confirmed', 'payment_window_expired') then
    raise exception 'Items cannot be reported unavailable at this stage (status: %)', o.supplier_confirmation_status;
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') then
    raise exception 'This order already has a payment being verified or paid';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);

  update public.order_items
    set supplier_status = 'unavailable', supplier_note = p_note
    where order_id = p_order_id and id = any (p_item_ids) and not excluded;
  get diagnostics v_updated = row_count;
  if v_updated = 0 or v_updated <> cardinality(p_item_ids) then
    raise exception 'Every reported item must belong to this order and still be part of it';
  end if;

  -- Any earlier confirmation can no longer be paid.
  update public.order_confirmations set state = 'superseded'
    where order_id = p_order_id and state in ('active', 'expired');

  select count(*) into v_remaining
    from public.order_items
    where order_id = p_order_id and not excluded and supplier_status <> 'unavailable';

  if v_remaining = 0 then
    v_new := 'unavailable';
    update public.orders
      set supplier_confirmation_status = v_new, fulfilment_status = 'cancelled'
      where id = p_order_id;
  else
    v_new := 'awaiting_customer_decision';
    update public.orders set supplier_confirmation_status = v_new where id = p_order_id;
  end if;

  perform set_config('rsn.trusted_change', 'off', true);
  return v_new;
end;
$$;

-- "Confirm Order". Only possible once RSN has:
--   1. confirmed supplier availability for EVERY remaining item (all become "available"),
--   2. set the delivery fee for the customer's address (must be given, may be 0),
--   3. set the confirmed price of every remaining item.
-- The total is calculated HERE as item prices x quantities + delivery fee,
-- stored in a new confirmation record, and the customer's 1-hour window starts.
-- p_item_prices = {"<order_item_id>": <confirmed unit price in kobo>, ...}
create function public.admin_confirm_order(
  p_order_id uuid,
  p_item_prices jsonb,
  p_delivery_fee_kobo bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  v_item record;
  v_price bigint;
  v_subtotal bigint := 0;
  v_item_count integer := 0;
  v_confirmation_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can confirm orders' using errcode = '42501';
  end if;
  if p_delivery_fee_kobo is null or p_delivery_fee_kobo < 0 then
    raise exception 'The delivery fee for this address must be set (zero or more)';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.supplier_confirmation_status not in
       ('awaiting_confirmation', 'confirmation_expired', 'confirmed', 'payment_window_expired') then
    raise exception 'This order cannot be confirmed (status: %)', o.supplier_confirmation_status;
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') or o.fulfilment_status <> 'pending' then
    raise exception 'This order already has a payment being verified, is paid, or is closed';
  end if;
  if exists (select 1 from public.order_items
             where order_id = p_order_id and not excluded and supplier_status = 'unavailable') then
    raise exception 'Some items are unavailable: the customer must decide before the order can be confirmed';
  end if;

  perform set_config('rsn.trusted_change', 'on', true);

  -- Any earlier confirmation can no longer be paid against.
  update public.order_confirmations set state = 'superseded'
    where order_id = p_order_id and state in ('active', 'expired');

  insert into public.order_confirmations
    (order_id, confirmed_by, payment_due_at, subtotal_kobo, delivery_fee_kobo, total_kobo)
  values
    (p_order_id, auth.uid(), now() + public.rsn_payment_window(), 0, p_delivery_fee_kobo, p_delivery_fee_kobo)
  returning id into v_confirmation_id;

  for v_item in
    select id, quantity from public.order_items where order_id = p_order_id and not excluded
  loop
    v_price := (p_item_prices ->> v_item.id::text)::bigint;
    if v_price is null or v_price < 0 then
      raise exception 'Missing or invalid confirmed price for order item %', v_item.id;
    end if;
    insert into public.order_confirmation_items (confirmation_id, order_item_id, unit_price_kobo, quantity)
      values (v_confirmation_id, v_item.id, v_price, v_item.quantity);
    update public.order_items set supplier_status = 'available' where id = v_item.id;
    v_subtotal := v_subtotal + v_price * v_item.quantity;
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count = 0 then
    raise exception 'This order has no items to confirm';
  end if;
  if (select count(*) from jsonb_object_keys(p_item_prices)) <> v_item_count then
    raise exception 'Prices were given for items that are not part of this order';
  end if;

  update public.order_confirmations
    set subtotal_kobo = v_subtotal, total_kobo = v_subtotal + p_delivery_fee_kobo
    where id = v_confirmation_id;
  update public.orders
    set supplier_confirmation_status = 'confirmed',
        subtotal_kobo = v_subtotal,
        delivery_fee_kobo = p_delivery_fee_kobo,
        total_kobo = v_subtotal + p_delivery_fee_kobo
    where id = p_order_id;

  perform set_config('rsn.trusted_change', 'off', true);
  return v_confirmation_id;
end;
$$;

-- Supplier doesn't have anything: order cancelled before any money is taken.
create function public.admin_mark_order_unavailable(p_order_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can do this' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') then
    raise exception 'This order already has a payment being verified or paid';
  end if;
  perform set_config('rsn.trusted_change', 'on', true);
  update public.order_items
    set supplier_status = 'unavailable', supplier_note = coalesce(p_note, supplier_note)
    where order_id = p_order_id and not excluded;
  update public.order_confirmations set state = 'cancelled'
    where order_id = p_order_id and state in ('active', 'expired');
  update public.orders
    set supplier_confirmation_status = 'unavailable', fulfilment_status = 'cancelled'
    where id = p_order_id;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- Cancel an unpaid order for another reason (e.g. RSN's 3 hours passed and
-- the customer no longer wants it).
create function public.admin_cancel_unpaid_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can do this' using errcode = '42501';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.payment_status not in ('pending', 'failed', 'rejected') then
    raise exception 'This order already has a payment being verified or paid';
  end if;
  perform set_config('rsn.trusted_change', 'on', true);
  update public.order_confirmations set state = 'cancelled'
    where order_id = p_order_id and state in ('active', 'expired');
  update public.orders set fulfilment_status = 'cancelled' where id = p_order_id;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- "Confirm Payment" for a bank transfer, after RSN checks the real bank account.
-- RSN enters the amount that actually arrived; it must equal the confirmed total.
-- Payment -> Confirmed, order -> Processing.
create function public.admin_confirm_bank_transfer(p_payment_id uuid, p_amount_received_kobo bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  c public.order_confirmations;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can confirm payments' using errcode = '42501';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found or p.method <> 'bank_transfer' or p.status <> 'awaiting_verification' then
    raise exception 'Only a bank transfer awaiting verification can be confirmed';
  end if;
  if p_amount_received_kobo is distinct from p.amount_kobo then
    raise exception 'Amount received (%) does not match the confirmed total (%). Reject the payment or contact the customer.',
      p_amount_received_kobo, p.amount_kobo;
  end if;
  if p.order_confirmation_id is not null then
    select * into c from public.order_confirmations where id = p.order_confirmation_id for update;
    if c.state not in ('active', 'expired') then
      raise exception 'This payment belongs to a confirmation that was replaced or cancelled';
    end if;
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.payments
    set status = 'confirmed', amount_received_kobo = p_amount_received_kobo,
        verified_at = now(), verified_by = auth.uid()
    where id = p_payment_id;
  update public.orders
    set payment_status = 'confirmed',
        supplier_confirmation_status = case
          when supplier_confirmation_status = 'not_required' then 'not_required'::public.supplier_confirmation_status
          else 'confirmed'::public.supplier_confirmation_status end,
        fulfilment_status = 'processing'
    where id = p.order_id;
  if p.order_confirmation_id is not null then
    update public.order_confirmations set state = 'paid' where id = p.order_confirmation_id;
  end if;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- The money did not arrive (or the wrong amount arrived): payment -> Rejected.
-- If the payment window is still open, the customer can try again.
create function public.admin_reject_bank_transfer(
  p_payment_id uuid,
  p_reason text,
  p_amount_received_kobo bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
begin
  if not public.is_admin() then
    raise exception 'Only RSN admins can reject payments' using errcode = '42501';
  end if;
  select * into p from public.payments where id = p_payment_id for update;
  if not found or p.method <> 'bank_transfer' or p.status <> 'awaiting_verification' then
    raise exception 'Only a bank transfer awaiting verification can be rejected';
  end if;
  perform set_config('rsn.trusted_change', 'on', true);
  update public.payments
    set status = 'rejected', rejection_reason = p_reason, amount_received_kobo = p_amount_received_kobo,
        verified_at = now(), verified_by = auth.uid()
    where id = p_payment_id;
  update public.orders set payment_status = 'rejected' where id = p.order_id;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. The customer's decision on a partly-unavailable order.
--   'continue' -> unavailable items are marked excluded (kept on record),
--                 order goes back to RSN to confirm the remaining items,
--                 the delivery fee and the new total
--   'cancel'   -> order cancelled, nothing paid
-- ---------------------------------------------------------------------

-- The shared logic (not callable directly by anyone).
create function public.apply_unavailable_items_decision(p_order_id uuid, p_decision text)
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
    -- OPEN DECISION: RSN's original 3-hour deadline still applies (may already have passed).
    update public.orders set supplier_confirmation_status = 'awaiting_confirmation' where id = p_order_id;
  else
    update public.orders set fulfilment_status = 'cancelled' where id = p_order_id;
  end if;
  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- Signed-in customer (their own order only) or an admin on the customer's behalf.
create function public.decide_on_unavailable_items(p_order_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or exists (select 1 from public.orders
               where id = p_order_id and customer_id is not null and customer_id = auth.uid())
  ) then
    raise exception 'You cannot make decisions on this order' using errcode = '42501';
  end if;
  perform public.apply_unavailable_items_decision(p_order_id, p_decision);
end;
$$;

-- Our server, after checking a guest's private order link.
create function public.server_decide_on_unavailable_items(p_order_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_unavailable_items_decision(p_order_id, p_decision);
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Server-only actions (our Next.js backend with the secret key, or the scheduler)
-- ---------------------------------------------------------------------

-- Record a Paystack payment AFTER the server has verified it with Paystack.
-- Accepted only if: the amount equals the payment's confirmed amount, the
-- customer paid before that confirmation's deadline, and that confirmation
-- hasn't been replaced or cancelled.
-- Returns 'confirmed', 'already_confirmed' or 'late_needs_review'.
create function public.record_paystack_payment(
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
  if p.status <> 'pending' then
    raise exception 'This payment is not pending';
  end if;
  if p_amount_kobo <> p.amount_kobo then
    raise exception 'Paystack amount does not match the confirmed total';
  end if;

  if p.order_confirmation_id is not null then
    select * into c from public.order_confirmations where id = p.order_confirmation_id for update;
    if c.state not in ('active', 'expired') or p_paid_at > c.payment_due_at then
      -- Paid too late, or against a replaced confirmation: nothing is confirmed.
      -- RSN reviews it (refund or reconfirm).
      return 'late_needs_review';
    end if;
  end if;

  perform set_config('rsn.trusted_change', 'on', true);
  update public.payments
    set status = 'confirmed', paid_at = p_paid_at, verified_at = now()
    where id = p.id;
  update public.orders
    set payment_status = 'confirmed',
        supplier_confirmation_status = case
          when supplier_confirmation_status = 'not_required' then 'not_required'::public.supplier_confirmation_status
          else 'confirmed'::public.supplier_confirmation_status end,
        fulfilment_status = 'processing'
    where id = p.order_id;
  if p.order_confirmation_id is not null then
    update public.order_confirmations set state = 'paid' where id = p.order_confirmation_id;
  end if;
  perform set_config('rsn.trusted_change', 'off', true);
  return 'confirmed';
end;
$$;

-- Marks overdue orders so the dashboard and emails are accurate.
-- Correctness never depends on this running: every payment checks the deadline itself.
create function public.expire_overdue_orders(
  out confirmations_overdue integer,
  out payment_windows_expired integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('rsn.trusted_change', 'on', true);

  -- RSN's 3 hours passed without "Confirm Order"
  with overdue as (
    update public.orders
      set supplier_confirmation_status = 'confirmation_expired'
      where supplier_confirmation_status = 'awaiting_confirmation'
        and confirmation_due_at < now()
        and fulfilment_status = 'pending'
      returning 1
  )
  select count(*) into confirmations_overdue from overdue;

  -- Customer's 1 hour passed without payment (orders with a proof awaiting
  -- verification, or already paid, are left alone)
  with expired as (
    update public.order_confirmations c
      set state = 'expired'
      from public.orders o
      where c.order_id = o.id
        and c.state = 'active'
        and c.payment_due_at < now()
        and o.payment_status in ('pending', 'failed', 'rejected')
      returning c.order_id
  ),
  orders_updated as (
    update public.orders
      set supplier_confirmation_status = 'payment_window_expired'
      where id in (select order_id from expired)
      returning 1
  )
  select count(*) into payment_windows_expired from orders_updated;

  perform set_config('rsn.trusted_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 12. Who may run what
-- ---------------------------------------------------------------------
revoke execute on function
  public.payment_window_for_order(uuid),
  public.record_paystack_payment(text, bigint, timestamptz),
  public.expire_overdue_orders(),
  public.admin_report_unavailable_items(uuid, uuid[], text),
  public.admin_confirm_order(uuid, jsonb, bigint),
  public.admin_mark_order_unavailable(uuid, text),
  public.admin_cancel_unpaid_order(uuid),
  public.admin_confirm_bank_transfer(uuid, bigint),
  public.admin_reject_bank_transfer(uuid, text, bigint),
  public.decide_on_unavailable_items(uuid, text),
  public.server_decide_on_unavailable_items(uuid, text),
  public.apply_unavailable_items_decision(uuid, text),
  public.set_order_confirmation_deadline(),
  public.guard_checkout_fields(),
  public.check_new_payment(),
  public.check_new_payment_proof(),
  public.mark_payment_awaiting_verification()
from public, anon, authenticated;

-- Admin actions: callable by signed-in users, but each one refuses non-admins.
-- decide_on_unavailable_items: signed-in users, but only for their own order.
grant execute on function
  public.admin_report_unavailable_items(uuid, uuid[], text),
  public.admin_confirm_order(uuid, jsonb, bigint),
  public.admin_mark_order_unavailable(uuid, text),
  public.admin_cancel_unpaid_order(uuid),
  public.admin_confirm_bank_transfer(uuid, bigint),
  public.admin_reject_bank_transfer(uuid, text, bigint),
  public.decide_on_unavailable_items(uuid, text)
to authenticated;

-- Server-only actions: only our backend (secret key) and the scheduler.
grant execute on function
  public.payment_window_for_order(uuid),
  public.record_paystack_payment(text, bigint, timestamptz),
  public.expire_overdue_orders(),
  public.server_decide_on_unavailable_items(uuid, text)
to service_role;

-- ---------------------------------------------------------------------
-- 13. Security rules for the new tables: customers see their own, admins see all,
--     nobody writes directly (only through the functions above).
-- ---------------------------------------------------------------------
alter table public.order_confirmations enable row level security;
alter table public.order_confirmation_items enable row level security;
revoke all on public.order_confirmations, public.order_confirmation_items from anon, authenticated;
grant select on public.order_confirmations, public.order_confirmation_items to authenticated;

create policy "Customers can view confirmations of their own orders"
  on public.order_confirmations for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
      where o.id = order_confirmations.order_id and o.customer_id = (select auth.uid())
    )
  );

create policy "Customers can view confirmed prices on their own orders"
  on public.order_confirmation_items for select to authenticated
  using (
    exists (
      select 1 from public.order_confirmations c
      where c.id = order_confirmation_items.confirmation_id
    )
  );

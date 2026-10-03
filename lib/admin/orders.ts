import "server-only";
import { createClient } from "@/lib/supabase/server";

/*
  ORDER DATA FOR THE ADMIN AREA.
  Everything here runs as the signed-in admin: the database's security rules
  only return orders because the account is in the `admins` table.
*/

export type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  confirmation_due_at: string | null;
  supplier_confirmation_status: string;
  payment_status: string;
  fulfilment_status: string;
  payment_method: string;
  subtotal_kobo: number;
  delivery_fee_kobo: number;
  total_kobo: number;
  delivery_name: string;
  delivery_email: string;
  delivery_phone: string;
  delivery_address_line1: string;
  delivery_city: string;
  delivery_state: string;
  customer_decided_at: string | null;
};

export type OrderItemRow = {
  id: string;
  product_id: string | null;
  product_name: string;
  size: string | null;
  quantity: number;
  unit_price_kobo: number;
  availability_at_order: string;
  supplier_status: "pending" | "available" | "unavailable";
  supplier_note: string | null;
  excluded: boolean;
};

export type ConfirmationRow = {
  id: string;
  confirmed_at: string;
  payment_due_at: string;
  subtotal_kobo: number;
  delivery_fee_kobo: number;
  total_kobo: number;
  state: "active" | "expired" | "superseded" | "paid" | "cancelled";
};

export type PaymentRow = {
  id: string;
  method: string;
  amount_kobo: number;
  status: string;
  created_at: string;
};

const ORDER_COLUMNS =
  "id, order_number, created_at, confirmation_due_at, supplier_confirmation_status, payment_status, fulfilment_status, payment_method, subtotal_kobo, delivery_fee_kobo, total_kobo, delivery_name, delivery_email, delivery_phone, delivery_address_line1, delivery_city, delivery_state, customer_decided_at";

// ---------------------------------------------------------------------
// The status shown to the admin, worked out from the stored statuses AND
// the deadlines (so "overdue" is correct even before the expiry job runs).
// ---------------------------------------------------------------------
export type Stage =
  | "needs_confirmation"
  | "confirmation_overdue"
  | "waiting_customer_decision"
  | "awaiting_payment"
  | "payment_window_expired"
  | "payment_to_verify"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "unavailable";

export const STAGE_LABELS: Record<Stage, string> = {
  needs_confirmation: "Needs confirmation",
  confirmation_overdue: "Overdue: needs action",
  waiting_customer_decision: "Waiting for customer decision",
  awaiting_payment: "Awaiting payment",
  payment_window_expired: "Payment window expired",
  payment_to_verify: "Payment to verify",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  unavailable: "Unavailable",
};

export type Tab = "action" | "customer" | "progress" | "closed" | "all";
export const TABS: { id: Tab; label: string; stages: Stage[] | null }[] = [
  { id: "action", label: "Action needed", stages: ["needs_confirmation", "confirmation_overdue", "payment_window_expired", "payment_to_verify"] },
  { id: "customer", label: "Waiting on customer", stages: ["waiting_customer_decision", "awaiting_payment"] },
  { id: "progress", label: "In progress", stages: ["processing", "shipped"] },
  { id: "closed", label: "Closed", stages: ["delivered", "cancelled", "unavailable"] },
  { id: "all", label: "All", stages: null },
];

export function orderStage(
  o: OrderRow,
  activeConfirmation: Pick<ConfirmationRow, "payment_due_at"> | null,
  now = Date.now(),
): Stage {
  if (o.fulfilment_status === "cancelled") return o.supplier_confirmation_status === "unavailable" ? "unavailable" : "cancelled";
  if (o.fulfilment_status === "delivered") return "delivered";
  if (o.fulfilment_status === "shipped") return "shipped";
  if (o.fulfilment_status === "processing") return "processing";
  if (o.payment_status === "awaiting_verification") return "payment_to_verify";
  switch (o.supplier_confirmation_status) {
    case "awaiting_confirmation":
      return o.confirmation_due_at && Date.parse(o.confirmation_due_at) < now ? "confirmation_overdue" : "needs_confirmation";
    case "confirmation_expired":
      return "confirmation_overdue";
    case "awaiting_customer_decision":
      return "waiting_customer_decision";
    case "payment_window_expired":
      return "payment_window_expired";
    case "confirmed":
      // Payable only while there is an ACTIVE confirmation inside its 1-hour window.
      return activeConfirmation && Date.parse(activeConfirmation.payment_due_at) >= now ? "awaiting_payment" : "payment_window_expired";
    default:
      return "needs_confirmation";
  }
}

export type OrderListItem = OrderRow & { itemCount: number; stage: Stage; paymentDueAt: string | null };

export async function listOrders(): Promise<OrderListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_items(count), order_confirmations(payment_due_at, state)`)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`Could not load orders (${error.code})`);

  const now = Date.now();
  return (data as unknown as (OrderRow & {
    order_items: { count: number }[];
    order_confirmations: { payment_due_at: string; state: ConfirmationRow["state"] }[];
  })[]).map((o) => {
    const active = o.order_confirmations.find((c) => c.state === "active") ?? null;
    return {
      ...o,
      itemCount: o.order_items[0]?.count ?? 0,
      paymentDueAt: active?.payment_due_at ?? null,
      stage: orderStage(o, active, now),
    };
  });
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const [order, items, confirmations, payments] = await Promise.all([
    supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_id, product_name, size, quantity, unit_price_kobo, availability_at_order, supplier_status, supplier_note, excluded")
      .eq("order_id", id)
      .order("product_name"),
    supabase
      .from("order_confirmations")
      .select("id, confirmed_at, payment_due_at, subtotal_kobo, delivery_fee_kobo, total_kobo, state")
      .eq("order_id", id)
      .order("confirmed_at", { ascending: false }),
    supabase.from("payments").select("id, method, amount_kobo, status, created_at").eq("order_id", id).order("created_at"),
  ]);
  if (order.error || items.error || confirmations.error || payments.error) {
    throw new Error("Could not load the order");
  }
  if (!order.data) return null;

  const o = order.data as unknown as OrderRow;
  const confs = (confirmations.data ?? []) as unknown as ConfirmationRow[];
  const active = confs.find((c) => c.state === "active") ?? null;
  return {
    order: o,
    items: (items.data ?? []) as unknown as OrderItemRow[],
    confirmations: confs,
    activeConfirmation: active,
    payments: (payments.data ?? []) as unknown as PaymentRow[],
    stage: orderStage(o, active),
  };
}

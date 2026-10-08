import "server-only";
import { createHash } from "crypto";
import { getCustomer } from "@/lib/customer/session";
import { createAdminClient } from "@/lib/supabase/admin";

/*
  A GUEST'S ORDER, reached through their private order link.
  The link carries a secret (`token`); the database only answers when the
  SHA-256 fingerprint of that secret matches the order. A signed-in customer
  reaches their own orders without the link (see orderKey). Shared by the order
  page and the /api/orders/[id] addresses (for the future mobile app).
*/

export type GuestOrderItem = {
  id: string;
  name: string;
  size: string | null;
  quantity: number;
  unit_price_kobo: number;
  availability_at_order: string;
  supplier_status: "pending" | "available" | "unavailable";
  supplier_note: string | null;
  excluded: boolean;
  confirmed_unit_price_kobo: number | null;
};

export type GuestOrder = {
  order_id: string;
  order_number: string;
  placed_at: string;
  supplier_confirmation_status: string;
  payment_status: string;
  fulfilment_status: string;
  payment_method: "bank_transfer" | "paystack";
  confirmation_due_at: string | null;
  customer_decided_at: string | null;
  delivery: { name: string; email: string; phone: string; address: string; city: string; state: string };
  items: GuestOrderItem[];
  // Only RSN's confirmed amounts (null until RSN confirms).
  confirmation: {
    confirmed_at: string;
    payment_due_at: string;
    subtotal_kobo: number;
    delivery_fee_kobo: number;
    total_kobo: number;
  } | null;
  payment_open: boolean;
  // The most recent payment attempt (if any), incl. RSN's reason when a transfer was rejected.
  latest_payment: {
    method: "bank_transfer" | "paystack";
    status: string;
    rejection_reason: string | null;
    has_proof: boolean;
    created_at: string;
  } | null;
};

// What the customer sees, worked out from the statuses and deadlines.
export type CustomerStage =
  | "confirming"
  | "confirming_late"
  | "your_decision"
  | "pay_now"
  | "payment_expired"
  | "payment_review"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "unavailable";

export function customerStage(o: GuestOrder, now = Date.now()): CustomerStage {
  if (o.fulfilment_status === "cancelled") return o.supplier_confirmation_status === "unavailable" ? "unavailable" : "cancelled";
  if (o.fulfilment_status === "delivered") return "delivered";
  if (o.fulfilment_status === "shipped") return "shipped";
  if (o.fulfilment_status === "processing") return "processing";
  if (o.payment_status === "awaiting_verification") return "payment_review";
  switch (o.supplier_confirmation_status) {
    case "awaiting_confirmation":
      return o.confirmation_due_at && Date.parse(o.confirmation_due_at) < now ? "confirming_late" : "confirming";
    case "confirmation_expired":
      return "confirming_late";
    case "awaiting_customer_decision":
      return "your_decision";
    case "confirmed":
      return o.payment_open ? "pay_now" : "payment_expired";
    default:
      return "payment_expired";
  }
}

// Can the customer still cancel this order themselves? (any time before paying)
export function canCustomerCancel(o: GuestOrder) {
  return (
    o.fulfilment_status === "pending" &&
    ["pending", "failed", "rejected"].includes(o.payment_status) &&
    o.supplier_confirmation_status !== "unavailable"
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{40,64}$/;

/*
  The order's private-link fingerprint, which every order function checks.
  - With the private link's secret: its SHA-256 fingerprint.
  - Without it, for a signed-in customer: the fingerprint of the order IF it
    belongs to their account (otherwise null, as for a wrong link).
  Pass the request from API routes (the app signs in with a header); pages
  leave it out and the login cookie is used.
*/
export async function orderKey(orderId: string, token: string | null | undefined, request?: Request) {
  if (!UUID.test(orderId)) return null;
  if (token && TOKEN.test(token)) return createHash("sha256").update(token).digest("hex");
  const customer = await getCustomer(request);
  if (!customer) return null;
  const { data, error } = await createAdminClient().rpc("customer_order_hash", { p_order_id: orderId, p_customer_id: customer.id });
  if (error) {
    console.error("[guest order] could not check the account:", error.code);
    return null;
  }
  return typeof data === "string" ? data : null;
}

export async function getGuestOrder(orderId: string, hash: string | null): Promise<GuestOrder | null> {
  if (!hash) return null;
  const { data, error } = await createAdminClient().rpc("guest_order_details", { p_order_id: orderId, p_token_hash: hash });
  if (error) {
    console.error("[guest order] could not load:", error.code);
    throw new Error("Could not load the order");
  }
  return (data as GuestOrder | null) ?? null;
}

export type GuestActionResult = { ok: true } | { ok: false; status: number; message: string };

function explain(error: { message?: string; code?: string }): GuestActionResult {
  const msg = error.message ?? "";
  if (msg.includes("RSN_NOT_FOUND")) return { ok: false, status: 404, message: "We couldn't find that order." };
  if (msg.includes("already cancelled")) return { ok: false, status: 409, message: "This order is already cancelled." };
  if (msg.includes("payment being verified or already paid")) {
    return { ok: false, status: 409, message: "This order has a payment in progress, so it can't be cancelled here. Please contact RSN." };
  }
  if (msg.includes("not waiting for a customer decision")) return { ok: false, status: 409, message: "This order no longer needs your decision." };
  console.error("[guest order] action failed:", error.code);
  return { ok: false, status: 500, message: "Something went wrong. Please try again in a moment." };
}

export async function cancelGuestOrder(orderId: string, hash: string | null): Promise<GuestActionResult> {
  if (!hash) return { ok: false, status: 404, message: "We couldn't find that order." };
  const { error } = await createAdminClient().rpc("guest_cancel_order", { p_order_id: orderId, p_token_hash: hash });
  return error ? explain(error) : { ok: true };
}

export async function decideGuestOrder(
  orderId: string,
  hash: string | null,
  decision: unknown,
): Promise<GuestActionResult> {
  if (!hash) return { ok: false, status: 404, message: "We couldn't find that order." };
  if (decision !== "continue" && decision !== "cancel") return { ok: false, status: 400, message: "Please choose to continue or cancel." };
  const { error } = await createAdminClient().rpc("guest_decide_on_unavailable_items", {
    p_order_id: orderId,
    p_token_hash: hash,
    p_decision: decision,
  });
  return error ? explain(error) : { ok: true };
}

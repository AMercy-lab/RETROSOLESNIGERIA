"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

/*
  Admin actions on one order. Each one:
    1. re-checks on the server that the user is an RSN admin,
    2. calls the matching database function, which checks admin rights
       AGAIN and enforces every business rule (deadlines, totals, statuses),
    3. returns a plain-English result.
*/

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "₦2,500" / "2500" / "2,500.50" -> kobo. null when not a valid amount.
function nairaToKobo(input: FormDataEntryValue | null): number | null {
  const cleaned = String(input ?? "").replace(/[₦,\s]/g, "");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

async function guard(orderId: string): Promise<string | null> {
  if (!UUID.test(orderId)) return "Unknown order.";
  const session = await getAdminSession();
  return session.status === "admin" ? null : "Only RSN admins can do this. Please sign in again.";
}

// After a successful action: refresh the lists and reload the order page with a
// message banner (the form used may no longer be shown, e.g. after cancelling).
function done(
  orderId: string,
  what: "confirmed" | "reported" | "all_unavailable" | "unavailable" | "cancelled" | "payment_confirmed" | "payment_rejected",
): never {
  revalidatePath("/admin");
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}?done=${what}`);
}

// Database errors -> friendly messages (technical details are logged, not shown).
function explain(error: { message?: string; code?: string } | null, fallback: string): ActionState {
  const msg = error?.message ?? "";
  console.error("[admin order action]", error?.code ?? "", msg);
  const known = [
    "This order cannot be confirmed",
    "Some items are unavailable: the customer must decide",
    "This order already has a payment",
    "The delivery fee for this address must be set",
    "Missing or invalid confirmed price",
    "Items cannot be reported unavailable at this stage",
    "Every reported item must belong to this order",
    "Amount received",
    "Only a bank transfer awaiting verification",
    "This payment belongs to a confirmation that was replaced or cancelled",
  ].find((k) => msg.includes(k));
  return { status: "error", message: known ? msg.replace(/\s*\(status: [a-z_]+\)/, "") + "." : fallback };
}

export async function confirmOrder(orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };

  const fee = nairaToKobo(formData.get("delivery_fee"));
  if (fee === null) return { status: "error", message: "Please enter the delivery fee in naira (it can be 0)." };

  const prices: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("price:")) continue;
    const itemId = key.slice("price:".length);
    const kobo = nairaToKobo(value);
    if (!UUID.test(itemId) || kobo === null) return { status: "error", message: "Please enter a valid price for every item." };
    prices[itemId] = kobo;
  }
  if (Object.keys(prices).length === 0) return { status: "error", message: "There are no items to confirm." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_confirm_order", {
    p_order_id: orderId,
    p_item_prices: prices,
    p_delivery_fee_kobo: fee,
  });
  if (error) return explain(error, "The order could not be confirmed. Please try again.");

  done(orderId, "confirmed");
}

export async function reportUnavailableItems(orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };

  const itemIds = formData.getAll("item").map(String).filter((id) => UUID.test(id));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (itemIds.length === 0) return { status: "error", message: "Tick at least one unavailable item." };
  if (!note) return { status: "error", message: "Please add a short note for the customer, e.g. \"Size 43 sold out\"." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report_unavailable_items", {
    p_order_id: orderId,
    p_item_ids: itemIds,
    p_note: note,
  });
  if (error) return explain(error, "The items could not be marked unavailable. Please try again.");

  done(orderId, data === "unavailable" ? "all_unavailable" : "reported");
}

export async function markOrderUnavailable(orderId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_mark_order_unavailable", { p_order_id: orderId, p_note: note });
  if (error) return explain(error, "The order could not be marked unavailable. Please try again.");

  done(orderId, "unavailable");
}

export async function cancelUnpaidOrder(orderId: string): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_unpaid_order", { p_order_id: orderId });
  if (error) return explain(error, "The order could not be cancelled. Please try again.");

  done(orderId, "cancelled");
}

// "Confirm payment": RSN enters the amount that actually arrived in the bank.
// The database only confirms it if it matches the confirmed total exactly.
export async function confirmBankTransfer(orderId: string, paymentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };
  if (!UUID.test(paymentId)) return { status: "error", message: "Unknown payment." };
  const received = nairaToKobo(formData.get("amount_received"));
  if (received === null) return { status: "error", message: "Please enter the amount you received in naira." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_confirm_bank_transfer", { p_payment_id: paymentId, p_amount_received_kobo: received });
  if (error) return explain(error, "The payment could not be confirmed. Please try again.");
  done(orderId, "payment_confirmed");
}

// "Reject": the money did not arrive (or not the right amount). The customer sees the reason.
export async function rejectBankTransfer(orderId: string, paymentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const denied = await guard(orderId);
  if (denied) return { status: "error", message: denied };
  if (!UUID.test(paymentId)) return { status: "error", message: "Unknown payment." };
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  if (!reason) return { status: "error", message: "Please give the customer a short reason, e.g. \"No transfer received yet\"." };
  const receivedText = String(formData.get("amount_received") ?? "").trim();
  const received = receivedText ? nairaToKobo(receivedText) : null;
  if (receivedText && received === null) return { status: "error", message: "The amount received should be a number in naira (or leave it empty)." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reject_bank_transfer", {
    p_payment_id: paymentId,
    p_reason: reason,
    p_amount_received_kobo: received,
  });
  if (error) return explain(error, "The payment could not be rejected. Please try again.");
  done(orderId, "payment_rejected");
}

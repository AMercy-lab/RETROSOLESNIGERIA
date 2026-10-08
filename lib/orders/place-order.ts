import "server-only";
import { createHash, randomBytes } from "crypto";
import { isNigerianState } from "@/lib/nigeria";
import { createAdminClient } from "@/lib/supabase/admin";

/*
  PLACING AN ORDER — the server-side business logic, shared by the website's
  checkout and (later) the RSN mobile app, both through POST /api/orders.

  1. Check the request carefully (never trust the browser).
  2. Create a private order link for the guest: a random secret the customer
     keeps; only its SHA-256 fingerprint is stored in the database.
  3. Ask the database's place_order() to create the order. The DATABASE takes
     every price, name and availability from the catalogue itself — nothing
     price-related is sent from here.
  4. If the customer is signed in, link the order to their account so it
     shows on every device they sign in on. (The private link still works.)
*/

export type PaymentMethod = "bank_transfer" | "paystack";

export type PlaceOrderInput = {
  delivery: { name: string; phone: string; email: string; address: string; city: string; state: string };
  paymentMethod: PaymentMethod;
  items: { productId: string; size: string | null; quantity: number }[];
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; confirmationDueAt: string; accessToken: string }
  | { ok: false; status: number; message: string; field?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max + 1) : "");

// Checks an untrusted request body and returns clean input, or a friendly problem.
export function validatePlaceOrder(body: unknown): { ok: true; input: PlaceOrderInput } | { ok: false; message: string; field?: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const d = (b.delivery && typeof b.delivery === "object" ? b.delivery : {}) as Record<string, unknown>;

  const name = str(d.name, 120);
  const email = str(d.email, 200).toLowerCase();
  const phone = str(d.phone, 30).replace(/[\s\-()]/g, "");
  const address = str(d.address, 300);
  const city = str(d.city, 100);
  const state = str(d.state, 60);

  if (name.length < 2 || name.length > 120) return { ok: false, field: "name", message: "Please enter your full name." };
  if (!/^\+?\d{10,15}$/.test(phone)) return { ok: false, field: "phone", message: "Please enter a valid phone number, e.g. 08031234567." };
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, field: "email", message: "Please enter a valid email address." };
  if (address.length < 5 || address.length > 300) return { ok: false, field: "address", message: "Please enter your full delivery address." };
  if (city.length < 2 || city.length > 100) return { ok: false, field: "city", message: "Please enter your city or town." };
  if (!isNigerianState(state)) return { ok: false, field: "state", message: "Please choose your state." };

  const paymentMethod = b.paymentMethod;
  if (paymentMethod !== "bank_transfer" && paymentMethod !== "paystack") {
    return { ok: false, field: "paymentMethod", message: "Please choose how you'd like to pay." };
  }

  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) {
    return { ok: false, message: "Your cart is empty or too large." };
  }
  const items: PlaceOrderInput["items"] = [];
  for (const raw of b.items) {
    const it = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const productId = typeof it.productId === "string" ? it.productId : "";
    const size = it.size === null || it.size === undefined ? null : typeof it.size === "string" ? it.size.trim().slice(0, 20) : "";
    const quantity = it.quantity;
    if (!UUID.test(productId) || size === "" || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10) {
      return { ok: false, message: "Something in your cart looks wrong. Please review your cart and try again." };
    }
    items.push({ productId, size, quantity: quantity as number });
  }

  return { ok: true, input: { delivery: { name, phone, email, address, city, state }, paymentMethod, items } };
}

export async function placeOrder(input: PlaceOrderInput, customerId?: string | null): Promise<PlaceOrderResult> {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    console.error("[orders] Checkout is not configured: SUPABASE_SECRET_KEY is missing.");
    return { ok: false, status: 503, message: "Checkout isn't available right now. Please try again later." };
  }

  // The guest's private link secret (shown to the customer once, never stored).
  const accessToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(accessToken).digest("hex");

  const { data, error } = await supabase.rpc("place_order", {
    p_customer_id: null, // placed with a private link; linked to the account below
    p_guest_token_hash: tokenHash,
    p_payment_method: input.paymentMethod,
    p_delivery: input.delivery,
    p_items: input.items.map((i) => ({ product_id: i.productId, size: i.size, quantity: i.quantity })),
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("RSN_UNAVAILABLE")) {
      return { ok: false, status: 409, message: "Some items in your cart are no longer available. Please review your cart." };
    }
    if (msg.includes("RSN_SIZE")) {
      return { ok: false, status: 409, message: "Please choose a valid size for every item in your cart." };
    }
    if (msg.includes("RSN_INVALID")) {
      return { ok: false, status: 400, message: "Please check your details and try again." };
    }
    console.error("[orders] place_order failed:", error.code);
    return { ok: false, status: 500, message: "We couldn't place your order just now. Please try again in a moment." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) {
    return { ok: false, status: 500, message: "We couldn't place your order just now. Please try again in a moment." };
  }

  if (customerId) {
    const linked = await supabase.rpc("claim_order", {
      p_order_id: row.order_id,
      p_customer_id: customerId,
      p_token_hash: tokenHash,
    });
    // Not fatal: the order exists, and signing in again links it by email.
    if (linked.error) console.error("[orders] could not link order to account:", linked.error.code);
  }

  return {
    ok: true,
    orderId: row.order_id,
    orderNumber: row.order_number,
    confirmationDueAt: row.confirmation_due_at,
    accessToken,
  };
}

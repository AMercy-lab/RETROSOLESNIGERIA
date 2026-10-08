import "server-only";
import type { GuestOrder } from "@/lib/orders/guest-order";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/*
  WHO IS THE SIGNED-IN CUSTOMER?
  - On the website: from the login cookie (set when they enter their email code).
  - In the RSN app: from the "Authorization: Bearer <token>" header the app sends.
  Either way Supabase's Auth server checks the login (getUser) — it is never
  just read from what the visitor sent.
*/
export type Customer = { id: string; email: string };

export async function getCustomer(request?: Request): Promise<Customer | null> {
  const auth = request?.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  try {
    const { data, error } = bearer
      ? await createAdminClient().auth.getUser(bearer)
      : await (await createClient()).auth.getUser();
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email.toLowerCase() };
  } catch {
    return null;
  }
}

// Link guest orders placed with this (verified) email to the account.
export async function claimOrdersByEmail(customerId: string) {
  const { error } = await createAdminClient().rpc("claim_orders_by_email", { p_customer_id: customerId });
  if (error) console.error("[customer] could not link guest orders:", error.code);
}

// All of the customer's orders, newest first (same details as the order page).
export async function listCustomerOrders(customerId: string): Promise<GuestOrder[]> {
  const { data, error } = await createAdminClient().rpc("customer_orders", { p_customer_id: customerId });
  if (error) {
    console.error("[customer] could not load orders:", error.code);
    throw new Error("Could not load your orders");
  }
  return Array.isArray(data) ? (data as GuestOrder[]) : [];
}

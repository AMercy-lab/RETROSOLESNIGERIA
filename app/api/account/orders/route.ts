import { NextResponse } from "next/server";
import { claimOrdersByEmail, getCustomer, listCustomerOrders } from "@/lib/customer/session";

/*
  GET /api/account/orders   (signed in: login cookie, or "Authorization: Bearer <login token>")
  The signed-in customer's orders from every device, newest first — used by
  the RSN app's "My orders". Guest orders placed with the same email are
  linked to the account first.
*/
export async function GET(request: Request) {
  const customer = await getCustomer(request);
  if (!customer) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await claimOrdersByEmail(customer.id);
    const orders = await listCustomerOrders(customer.id);
    return NextResponse.json({ email: customer.email, orders }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load your orders." }, { status: 500 });
  }
}

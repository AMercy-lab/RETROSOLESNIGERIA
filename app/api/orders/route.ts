import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/customer/session";
import { placeOrder, validatePlaceOrder } from "@/lib/orders/place-order";

/*
  POST /api/orders — place an order (website checkout and, later, the mobile app).

  Body: { delivery: {name, phone, email, address, city, state},
          paymentMethod: "bank_transfer" | "paystack",
          items: [{ productId, size, quantity }] }

  No prices are accepted: the database takes them from the catalogue.
  Response 201: { orderId, orderNumber, confirmationDueAt, accessToken }
  The accessToken is the guest's private order link secret — shown once.
  Signed in (login cookie, or "Authorization: Bearer" from the app), the order
  is also added to the customer's account.
*/
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const checked = validatePlaceOrder(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.message, field: checked.field }, { status: 400 });
  }

  const customer = await getCustomer(request);
  const result = await placeOrder(checked.input, customer?.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(
    {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      confirmationDueAt: result.confirmationDueAt,
      accessToken: result.accessToken,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

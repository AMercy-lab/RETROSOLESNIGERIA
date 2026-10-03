import { NextResponse } from "next/server";
import { placeOrder, validatePlaceOrder } from "@/lib/orders/place-order";

/*
  POST /api/orders — place an order (website checkout and, later, the mobile app).

  Body: { delivery: {name, phone, email, address, city, state},
          paymentMethod: "bank_transfer" | "paystack",
          items: [{ productId, size, quantity }] }

  No prices are accepted: the database takes them from the catalogue.
  Response 201: { orderId, orderNumber, confirmationDueAt, accessToken }
  The accessToken is the guest's private order link secret — shown once.
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

  const result = await placeOrder(checked.input);
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

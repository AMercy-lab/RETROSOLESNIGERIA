import { NextResponse } from "next/server";
import { cleanCart, getSavedCart, saveCart } from "@/lib/customer/cart";
import { getCustomer } from "@/lib/customer/session";

/*
  The signed-in customer's saved cart (login cookie, or "Authorization: Bearer"
  from the RSN app), so the website and the app show the same cart.
    GET  /api/account/cart   -> { email, lines, updatedAt }
    PUT  /api/account/cart   { lines } -> { updatedAt }   (replaces the cart)
  401 when signed out: the cart then stays on the device only.
*/
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const customer = await getCustomer(request);
  if (!customer) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: NO_STORE });
  try {
    const cart = await getSavedCart(customer.id);
    return NextResponse.json({ email: customer.email, ...cart }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Could not load your cart." }, { status: 500, headers: NO_STORE });
  }
}

export async function PUT(request: Request) {
  const customer = await getCustomer(request);
  if (!customer) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers: NO_STORE });
  const lines = cleanCart(await request.json().catch(() => null));
  if (!lines) return NextResponse.json({ error: "That doesn't look like a cart." }, { status: 400, headers: NO_STORE });
  try {
    const updatedAt = await saveCart(customer.id, lines);
    return NextResponse.json({ email: customer.email, updatedAt }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "Could not save your cart." }, { status: 500, headers: NO_STORE });
  }
}

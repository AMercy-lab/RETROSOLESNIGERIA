import { NextResponse, type NextRequest } from "next/server";
import { customerStage, getGuestOrder } from "@/lib/orders/guest-order";
import { getBankDetails } from "@/lib/store-settings";

/*
  GET /api/orders/<id>?token=<private link secret>
  The customer's own order, used by the RSN mobile app (the website page uses
  the same code). Answers 404 for an unknown order OR a wrong secret, so it
  never reveals whether an order exists.
  RSN's bank details are included only while the order is waiting for
  payment — exactly when the website's order page shows them.
*/
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  try {
    const order = await getGuestOrder(id, token);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    const bank = customerStage(order) === "pay_now" ? await getBankDetails() : null;
    return NextResponse.json({ order, bank }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the order." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { getGuestOrder } from "@/lib/orders/guest-order";

/*
  GET /api/orders/<id>?token=<private link secret>
  The customer's own order (for the future mobile app; the website page uses
  the same code). Answers 404 for an unknown order OR a wrong secret, so it
  never reveals whether an order exists.
*/
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  try {
    const order = await getGuestOrder(id, token);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ order }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the order." }, { status: 500 });
  }
}

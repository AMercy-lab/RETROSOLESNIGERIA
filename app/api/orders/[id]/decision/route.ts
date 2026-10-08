import { NextResponse } from "next/server";
import { decideGuestOrder, orderKey } from "@/lib/orders/guest-order";

// POST /api/orders/<id>/decision  { token, decision: "continue" | "cancel" }
// The customer's choice when some items are unavailable. (Signed in: token optional.)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; decision?: unknown };
  const token = typeof body.token === "string" ? body.token : null;
  const result = await decideGuestOrder(id, await orderKey(id, token, request), body.decision);
  return result.ok
    ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: result.message }, { status: result.status });
}

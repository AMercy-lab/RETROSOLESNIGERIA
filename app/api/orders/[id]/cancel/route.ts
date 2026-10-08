import { NextResponse } from "next/server";
import { cancelGuestOrder, orderKey } from "@/lib/orders/guest-order";

// POST /api/orders/<id>/cancel  { token }  — cancel any time before paying.
// (Signed-in customers may leave out the token.)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const token = typeof body.token === "string" ? body.token : null;
  const result = await cancelGuestOrder(id, await orderKey(id, token, request));
  return result.ok
    ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: result.message }, { status: result.status });
}

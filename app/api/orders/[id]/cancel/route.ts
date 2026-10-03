import { NextResponse } from "next/server";
import { cancelGuestOrder } from "@/lib/orders/guest-order";

// POST /api/orders/<id>/cancel  { token }  — cancel any time before paying.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { token?: unknown };
  const result = await cancelGuestOrder(id, typeof body.token === "string" ? body.token : null);
  return result.ok
    ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: result.message }, { status: result.status });
}

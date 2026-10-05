import { NextResponse } from "next/server";
import { submitTransferProof } from "@/lib/orders/bank-transfer";

/*
  POST /api/orders/<id>/transfer-proof  (multipart form: token, file, note)
  "I've made the transfer": uploads the receipt. The payment then waits for
  RSN to check the bank account — it is never confirmed automatically.
*/
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = form.get("token");
  const file = form.get("file");
  const note = form.get("note");
  const result = await submitTransferProof(
    id,
    typeof token === "string" ? token : null,
    file instanceof File ? file : null,
    typeof note === "string" ? note.trim() : "",
  );
  return result.ok
    ? NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json({ error: result.message }, { status: result.status });
}

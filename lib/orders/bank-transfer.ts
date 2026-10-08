import "server-only";
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/*
  A guest's bank-transfer receipt.
  1. Check the file (type, size, and that its contents really are an image/PDF).
  2. Start (or reuse) the bank-transfer payment for the order's confirmed total.
  3. Store the receipt in the PRIVATE "payment-proofs" storage, in this
     order's own folder.
  4. Attach it to the payment — the database then marks the payment
     "awaiting verification" (never "confirmed"; only RSN can confirm).
  Each database step checks the order's private-link fingerprint again
  (from the link's secret, or from the signed-in customer's account).
*/

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

const KINDS = [
  { type: "image/jpeg", ext: "jpg", magic: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", magic: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    type: "image/webp",
    ext: "webp",
    magic: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
  { type: "application/pdf", ext: "pdf", magic: (b: Uint8Array) => String.fromCharCode(...b.slice(0, 4)) === "%PDF" },
];

export type ProofResult = { ok: true } | { ok: false; status: number; message: string };

export async function submitTransferProof(
  orderId: string,
  hash: string | null,
  file: File | null,
  note: string,
): Promise<ProofResult> {
  if (!hash) return { ok: false, status: 404, message: "We couldn't find that order." };
  if (!file || file.size === 0) return { ok: false, status: 400, message: "Please choose your receipt (a photo, screenshot or PDF)." };
  if (file.size > MAX_PROOF_BYTES) return { ok: false, status: 400, message: "That file is too large. Please upload one under 5 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.magic(bytes));
  if (!kind) return { ok: false, status: 400, message: "Please upload a JPG, PNG or WEBP image, or a PDF." };

  const db = createAdminClient();

  const started = await db.rpc("guest_start_bank_transfer", { p_order_id: orderId, p_token_hash: hash });
  if (started.error) {
    const msg = started.error.message ?? "";
    if (msg.includes("RSN_NOT_FOUND")) return { ok: false, status: 404, message: "We couldn't find that order." };
    if (msg.includes("RSN_PAYMENT_CLOSED")) {
      return { ok: false, status: 409, message: "Payment isn't open for this order right now (it may have expired, or a payment is already being checked)." };
    }
    console.error("[transfer proof] start failed:", started.error.code);
    return { ok: false, status: 500, message: "Something went wrong. Please try again in a moment." };
  }
  const paymentId = started.data as string;

  const path = `guest/${orderId}/${paymentId}-${Date.now()}-${randomBytes(4).toString("hex")}.${kind.ext}`;
  const upload = await db.storage.from("payment-proofs").upload(path, bytes, { contentType: kind.type, upsert: false });
  if (upload.error) {
    console.error("[transfer proof] upload failed:", upload.error.message);
    return { ok: false, status: 500, message: "Your receipt couldn't be uploaded. Please try again." };
  }

  const saved = await db.rpc("guest_submit_transfer_proof", {
    p_order_id: orderId,
    p_token_hash: hash,
    p_payment_id: paymentId,
    p_storage_path: path,
    p_note: note.slice(0, 500),
  });
  if (saved.error) {
    await db.storage.from("payment-proofs").remove([path]); // don't keep a receipt that isn't attached
    const msg = saved.error.message ?? "";
    if (msg.includes("deadline")) return { ok: false, status: 409, message: "The 1-hour payment time has passed, so the receipt couldn't be accepted." };
    if (msg.includes("pending bank-transfer payment")) return { ok: false, status: 409, message: "A receipt is already being checked for this order." };
    console.error("[transfer proof] attach failed:", saved.error.code);
    return { ok: false, status: 500, message: "Something went wrong. Please try again in a moment." };
  }
  return { ok: true };
}

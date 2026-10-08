"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Bank = { bankName: string; accountName: string; accountNumber: string };

function CopyRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-muted">{label}</p>
        <p className="text-base font-semibold" data-testid={testId}>{value}</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked: the value is still visible to copy by hand.
          }
        }}
        className="shrink-0 rounded-full border border-brand-ink/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/*
  Paying by bank transfer: RSN's account details, the exact amount, and the
  "I've made the transfer" receipt upload. The receipt goes to
  /api/orders/<id>/transfer-proof (also usable by the future mobile app).
*/
export default function BankTransferPanel({
  orderId,
  token,
  orderNumber,
  amountText,
  bank,
}: {
  orderId: string;
  token: string | null; // null when the customer is signed in (the login cookie is used)
  orderNumber: string;
  amountText: string;
  bank: Bank | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Please choose your receipt (a photo, screenshot or PDF).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is too large. Please upload one under 5 MB.");
      return;
    }
    if (token) form.set("token", token);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/transfer-proof`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Your receipt couldn't be sent. Please try again.");
      else router.refresh();
    } catch {
      setError("We couldn't reach RSN. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!bank) {
    return (
      <p className="rounded-2xl bg-white px-4 py-3 text-sm">
        RSN will share the bank details with you shortly. Nothing has been charged.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="bank-transfer">
      <div className="rounded-2xl bg-white px-4 py-2">
        <CopyRow label="Amount to transfer" value={amountText} testId="transfer-amount" />
        <div className="border-t border-brand-ink/10" />
        <CopyRow label="Bank" value={bank.bankName} testId="bank-name" />
        <CopyRow label="Account name" value={bank.accountName} testId="account-name" />
        <CopyRow label="Account number" value={bank.accountNumber} testId="account-number" />
        <div className="border-t border-brand-ink/10" />
        <CopyRow label="Use as transfer description" value={orderNumber} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="font-semibold">I&apos;ve made the transfer</p>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.15em]">Your receipt (photo, screenshot or PDF, up to 5 MB)</span>
          <input name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-[0.15em]">Note for RSN (optional)</span>
          <input
            name="note"
            maxLength={500}
            placeholder="e.g. Sent from my GTBank account at 2:15pm"
            className="w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-brand-ink"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand-red px-7 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? "Sending your receipt…" : "Send my receipt"}
        </button>
        <p className="text-xs text-brand-muted">
          RSN checks its bank account before confirming your payment. Your order is prepared once the payment is
          confirmed.
        </p>
        {error && (
          <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

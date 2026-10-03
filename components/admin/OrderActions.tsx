"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "@/app/admin/(dashboard)/orders/[id]/actions";
import { formatNaira } from "@/lib/format";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;
type Item = { id: string; name: string; size: string | null; quantity: number; priceKobo: number };

const input =
  "w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-brand-ink";
const primary =
  "rounded-full bg-brand-red px-6 py-3.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-wait disabled:opacity-60";
const secondary =
  "rounded-full border border-brand-ink/20 px-6 py-3 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white disabled:opacity-60";

function Result({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm ${state.status === "error" ? "bg-brand-red/10 text-brand-red-dark" : "bg-brand-mist"}`}
    >
      {state.message}
    </p>
  );
}

// naira text -> kobo for the live total preview (invalid -> null)
function toKobo(text: string): number | null {
  const cleaned = text.replace(/[₦,\s]/g, "");
  return /^\d{1,9}(\.\d{1,2})?$/.test(cleaned) ? Math.round(Number(cleaned) * 100) : null;
}

// ---------------------------------------------------------------------
// Confirm Order: confirmed price per item + delivery fee -> locked total
// ---------------------------------------------------------------------
export function ConfirmOrderForm({ action, items }: { action: Action; items: Item[] }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, String(i.priceKobo / 100)])),
  );
  const [fee, setFee] = useState("");

  const preview = useMemo(() => {
    let subtotal = 0;
    for (const i of items) {
      const k = toKobo(prices[i.id] ?? "");
      if (k === null) return null;
      subtotal += k * i.quantity;
    }
    const f = toKobo(fee);
    return { subtotal, fee: f, total: f === null ? null : subtotal + f };
  }, [items, prices, fee]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Confirm this order? The customer will then have 1 hour to pay this total.")) e.preventDefault();
      }}
      className="flex flex-col gap-5"
      data-testid="confirm-form"
    >
      <p className="text-sm text-brand-muted">
        Only confirm after the supplier has confirmed every item and size below, and you&apos;ve worked out the delivery fee
        for this address.
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{i.name}</p>
              <p className="text-brand-muted">
                {i.size ? `Size ${i.size} · ` : ""}Qty {i.quantity}
              </p>
            </div>
            <label className="w-40">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest">Price each (₦)</span>
              <input
                name={`price:${i.id}`}
                inputMode="decimal"
                required
                value={prices[i.id]}
                onChange={(e) => setPrices((p) => ({ ...p, [i.id]: e.target.value }))}
                className={input}
              />
            </label>
          </li>
        ))}
      </ul>
      <label>
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest">
          Delivery fee for this address (₦) — required, can be 0
        </span>
        <input name="delivery_fee" inputMode="decimal" required value={fee} onChange={(e) => setFee(e.target.value)} placeholder="e.g. 2500" className={input} />
      </label>
      <dl className="rounded-2xl bg-brand-mist p-4 text-sm" data-testid="confirm-preview">
        <div className="flex justify-between">
          <dt>Items</dt>
          <dd>{preview ? formatNaira(preview.subtotal) : "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Delivery</dt>
          <dd>{preview?.fee != null ? formatNaira(preview.fee) : "—"}</dd>
        </div>
        <div className="mt-1 flex justify-between border-t border-brand-ink/10 pt-1 font-semibold">
          <dt>Customer pays</dt>
          <dd>{preview?.total != null ? formatNaira(preview.total) : "—"}</dd>
        </div>
      </dl>
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Confirming…" : "Confirm order"}
      </button>
      <Result state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------
// Report unavailable items (tick items + note for the customer)
// ---------------------------------------------------------------------
export function ReportUnavailableForm({ action, items }: { action: Action; items: Item[] }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="unavailable-form">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-brand-muted">Tick what the supplier can&apos;t supply:</legend>
        {items.map((i) => (
          <label key={i.id} className="flex items-center gap-3 text-sm">
            <input type="checkbox" name="item" value={i.id} className="h-4 w-4 accent-brand-red" />
            {i.name}
            {i.size ? ` (size ${i.size})` : ""} × {i.quantity}
          </label>
        ))}
      </fieldset>
      <label>
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest">Note for the customer</span>
        <input name="note" required maxLength={300} placeholder="e.g. Size 43 sold out at the supplier" className={input} />
      </label>
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Saving…" : "Mark ticked items unavailable"}
      </button>
      <Result state={state} />
    </form>
  );
}

// ---------------------------------------------------------------------
// Whole order unavailable / cancel unpaid order
// ---------------------------------------------------------------------
export function MarkUnavailableForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Mark the WHOLE order unavailable and cancel it?")) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input name="note" maxLength={300} placeholder="Optional note, e.g. Supplier out of stock" className={input} />
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Saving…" : "Whole order unavailable"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function CancelOrderForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("Cancel this unpaid order?")) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "Cancelling…" : "Cancel unpaid order"}
      </button>
      <Result state={state} />
    </form>
  );
}

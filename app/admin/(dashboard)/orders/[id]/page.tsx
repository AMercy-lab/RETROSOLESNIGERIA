import Link from "next/link";
import { notFound } from "next/navigation";
import Countdown from "@/components/Countdown";
import {
  CancelOrderForm,
  ConfirmOrderForm,
  ConfirmPaymentForm,
  MarkUnavailableForm,
  RejectPaymentForm,
  ReportUnavailableForm,
} from "@/components/admin/OrderActions";
import StageBadge from "@/components/admin/StageBadge";
import { ArrowLeftIcon } from "@/components/icons";
import { availabilityLabel, isProductAvailability } from "@/lib/catalog/availability";
import { getOrder } from "@/lib/admin/orders";
import { formatNaira } from "@/lib/format";
import {
  cancelUnpaidOrder,
  confirmBankTransfer,
  confirmOrder,
  markOrderUnavailable,
  rejectBankTransfer,
  reportUnavailableItems,
} from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function lagos(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

// Message shown after an action reloads the page (?done=...)
const DONE: Record<string, string> = {
  confirmed: "Order confirmed. The customer now has 1 hour to pay the total below.",
  reported: "Items marked unavailable. The customer now needs to choose: continue without them, or cancel.",
  all_unavailable: "Every item is unavailable, so the order has been cancelled. Nothing was paid.",
  unavailable: "Order marked unavailable and cancelled. Nothing was paid.",
  cancelled: "Order cancelled. Nothing was paid.",
  payment_confirmed: "Payment confirmed. The order is now Processing — time to prepare it for dispatch.",
  payment_rejected: "Payment rejected. The customer sees your reason and can send a new receipt while their hour lasts.",
};

const CONFIRMATION_STATE: Record<string, string> = {
  active: "Active — customer can pay",
  expired: "Expired (not paid in time)",
  superseded: "Replaced by a newer confirmation",
  paid: "Paid",
  cancelled: "Cancelled",
};

// One order: details, history and RSN's actions.
export default async function AdminOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { done } = await searchParams;
  const doneMessage = typeof done === "string" ? DONE[done] : undefined;
  if (!UUID.test(id)) notFound();
  const data = await getOrder(id);
  if (!data) notFound();
  const { order: o, items, confirmations, activeConfirmation, payments, stage } = data;

  const remaining = items.filter((i) => !i.excluded);
  const toVerify = payments.find((p) => p.method === "bank_transfer" && p.status === "awaiting_verification") ?? null;
  const canConfirm = ["needs_confirmation", "confirmation_overdue", "payment_window_expired", "awaiting_payment"].includes(stage);
  const canReport = canConfirm;
  const canCancel = !["processing", "shipped", "delivered", "cancelled", "unavailable", "payment_to_verify"].includes(stage);
  const formItems = remaining.map((i) => ({
    id: i.id,
    name: i.product_name,
    size: i.size,
    quantity: i.quantity,
    priceKobo: Number(i.unit_price_kobo),
  }));

  return (
    <div className="flex flex-col gap-8" data-testid="admin-order">
      <Link href="/admin" className="flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-widest hover:text-brand-red">
        <ArrowLeftIcon /> All orders
      </Link>

      {doneMessage && (
        <p role="status" data-testid="done-banner" className="rounded-2xl bg-brand-charcoal px-5 py-4 text-sm text-white">
          {doneMessage}
        </p>
      )}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-5xl leading-none tracking-wider">{o.order_number}</h1>
          <StageBadge stage={stage} />
        </div>
        <p className="text-sm text-brand-muted">Placed {lagos(o.created_at)}</p>
        {(stage === "needs_confirmation" || stage === "confirmation_overdue") && o.confirmation_due_at && (
          <p className="text-sm">
            Confirm by {lagos(o.confirmation_due_at)} — <Countdown dueAt={o.confirmation_due_at} />
          </p>
        )}
        {stage === "awaiting_payment" && activeConfirmation && (
          <p className="text-sm">
            Customer must pay {formatNaira(Number(activeConfirmation.total_kobo))} by {lagos(activeConfirmation.payment_due_at)} —{" "}
            <Countdown dueAt={activeConfirmation.payment_due_at} />
          </p>
        )}
        {stage === "waiting_customer_decision" && (
          <p className="text-sm">Waiting for the customer to continue without the unavailable items, or cancel.</p>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <div className="flex flex-col gap-8">
          {/* Items */}
          <section className="rounded-3xl border border-brand-ink/10 p-5 sm:p-6">
            <h2 className="mb-4 font-display text-3xl tracking-wide">Items</h2>
            <ul className="flex flex-col divide-y divide-brand-ink/10">
              {items.map((i) => (
                <li key={i.id} className={`flex flex-wrap justify-between gap-3 py-3 ${i.excluded ? "opacity-50" : ""}`}>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {i.product_name}
                      {i.excluded && <span className="ml-2 text-xs uppercase tracking-widest text-brand-red">Excluded</span>}
                    </p>
                    <p className="text-brand-muted">
                      {i.size ? `Size ${i.size} · ` : ""}Qty {i.quantity} · {formatNaira(Number(i.unit_price_kobo))} each when ordered
                    </p>
                    <p className="text-brand-muted">
                      Shown to customer:{" "}
                      {isProductAvailability(i.availability_at_order) ? availabilityLabel(i.availability_at_order) : i.availability_at_order}
                      {" · "}Supplier check: <span className="font-semibold text-brand-ink">{i.supplier_status}</span>
                      {i.supplier_note ? ` — "${i.supplier_note}"` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatNaira(Number(i.unit_price_kobo) * i.quantity)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-brand-muted">
              Items when ordered: {formatNaira(items.reduce((sum, i) => sum + Number(i.unit_price_kobo) * i.quantity, 0))} (prices at ordering, delivery not included)
            </p>
          </section>

          {/* Customer */}
          <section className="rounded-3xl border border-brand-ink/10 p-5 text-sm sm:p-6">
            <h2 className="mb-4 font-display text-3xl tracking-wide">Customer & delivery</h2>
            <p className="font-semibold">{o.delivery_name}</p>
            <p>
              <a href={`tel:${o.delivery_phone}`} className="underline underline-offset-4 hover:text-brand-red">{o.delivery_phone}</a>
              {" · "}
              <a href={`mailto:${o.delivery_email}`} className="underline underline-offset-4 hover:text-brand-red">{o.delivery_email}</a>
            </p>
            <p className="mt-2">{o.delivery_address_line1}</p>
            <p>
              {o.delivery_city}, {o.delivery_state}
            </p>
            <p className="mt-2 text-brand-muted">Prefers to pay by {o.payment_method === "paystack" ? "Paystack" : "bank transfer"}.</p>
          </section>

          {/* History */}
          {(confirmations.length > 0 || payments.length > 0) && (
            <section className="rounded-3xl border border-brand-ink/10 p-5 text-sm sm:p-6">
              <h2 className="mb-4 font-display text-3xl tracking-wide">History</h2>
              <ul className="flex flex-col gap-2">
                {confirmations.map((c) => (
                  <li key={c.id}>
                    Confirmed {lagos(c.confirmed_at)}: items {formatNaira(Number(c.subtotal_kobo))} + delivery{" "}
                    {formatNaira(Number(c.delivery_fee_kobo))} = <strong>{formatNaira(Number(c.total_kobo))}</strong> · pay by{" "}
                    {lagos(c.payment_due_at)} · <span className="text-brand-muted">{CONFIRMATION_STATE[c.state] ?? c.state}</span>
                  </li>
                ))}
                {payments.map((p) => (
                  <li key={p.id} className="text-brand-muted">
                    Payment ({p.method === "paystack" ? "Paystack" : "bank transfer"}) {formatNaira(Number(p.amount_kobo))} —{" "}
                    {p.status.replaceAll("_", " ")}
                    {p.amount_received_kobo != null ? ` · received ${formatNaira(Number(p.amount_received_kobo))}` : ""}
                    {p.rejection_reason ? ` · "${p.rejection_reason}"` : ""}
                    {p.proofs.length > 0 ? ` · ${p.proofs.length} receipt${p.proofs.length === 1 ? "" : "s"}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* RSN actions */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-32">
          {toVerify && (
            <section className="flex flex-col gap-4 rounded-3xl border-2 border-brand-red p-5 sm:p-6" data-testid="verify-payment">
              <h2 className="font-display text-3xl tracking-wide">Payment to verify</h2>
              <p className="text-sm">
                Bank transfer of <strong>{formatNaira(Number(toVerify.amount_kobo))}</strong> expected. Check your bank account
                (or bank SMS) before confirming.
              </p>
              {toVerify.proofs.map((proof) => (
                <div key={proof.id} className="flex flex-col gap-2 text-sm">
                  {proof.url ? (
                    proof.isPdf ? (
                      <a href={proof.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4 hover:text-brand-red">
                        Open receipt (PDF)
                      </a>
                    ) : (
                      <a href={proof.url} target="_blank" rel="noreferrer" title="Open full size">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private link */}
                        <img src={proof.url} alt="Customer's transfer receipt" className="max-h-80 w-full rounded-2xl bg-brand-mist object-contain" />
                      </a>
                    )
                  ) : (
                    <p className="text-brand-muted">Receipt couldn&apos;t be loaded — refresh the page.</p>
                  )}
                  <p className="text-brand-muted">
                    Sent {lagos(proof.created_at)}
                    {proof.customer_note ? ` — "${proof.customer_note}"` : ""}
                  </p>
                </div>
              ))}
              <ConfirmPaymentForm action={confirmBankTransfer.bind(null, o.id, toVerify.id)} expectedText={formatNaira(Number(toVerify.amount_kobo))} />
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold">Money didn&apos;t arrive? Reject</summary>
                <div className="mt-3">
                  <RejectPaymentForm action={rejectBankTransfer.bind(null, o.id, toVerify.id)} />
                </div>
              </details>
            </section>
          )}
          {canConfirm && remaining.length > 0 && (
            <section className="rounded-3xl bg-brand-mist p-5 sm:p-6">
              <h2 className="mb-4 font-display text-3xl tracking-wide">
                {confirmations.length > 0 ? "Reconfirm order" : "Confirm order"}
              </h2>
              <ConfirmOrderForm action={confirmOrder.bind(null, o.id)} items={formItems} />
            </section>
          )}
          {canReport && remaining.length > 0 && (
            <section className="rounded-3xl border border-brand-ink/10 p-5 sm:p-6">
              <h2 className="mb-4 font-display text-2xl tracking-wide">Some items unavailable?</h2>
              <ReportUnavailableForm action={reportUnavailableItems.bind(null, o.id)} items={formItems} />
            </section>
          )}
          {canCancel && (
            <section className="flex flex-col gap-4 rounded-3xl border border-brand-ink/10 p-5 sm:p-6">
              <h2 className="font-display text-2xl tracking-wide">Close this order</h2>
              <MarkUnavailableForm action={markOrderUnavailable.bind(null, o.id)} />
              <CancelOrderForm action={cancelUnpaidOrder.bind(null, o.id)} />
            </section>
          )}
          {!canConfirm && !canCancel && (
            <p className="rounded-3xl bg-brand-mist p-5 text-sm text-brand-muted">No actions needed for this order right now.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

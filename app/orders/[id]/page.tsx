import type { Metadata } from "next";
import Link from "next/link";
import Countdown from "@/components/Countdown";
import BankTransferPanel from "@/components/orders/BankTransferPanel";
import { CancelOrderButton, DecisionButtons } from "@/components/orders/GuestOrderActions";
import SectionHeading from "@/components/SectionHeading";
import { formatNaira } from "@/lib/format";
import { canCustomerCancel, customerStage, getGuestOrder, orderKey, type CustomerStage } from "@/lib/orders/guest-order";
import { getBankDetails } from "@/lib/store-settings";

// A private page: never indexed, never passes the link on to other websites.
export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

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

const STAGE_TITLE: Record<CustomerStage, string> = {
  confirming: "RSN is confirming your order",
  confirming_late: "Still confirming your order",
  your_decision: "Some items aren't available",
  pay_now: "Your order is confirmed",
  payment_expired: "Payment time has passed",
  payment_review: "Checking your payment",
  processing: "Being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Order cancelled",
  unavailable: "Not available",
};

function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
      <SectionHeading as="h1" eyebrow="Your order" title="We couldn't find that order" />
      <p className="text-brand-muted">
        The link may be incomplete. Sign in with the email you ordered with to see all your orders, or open the full
        link you received.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/account"
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
        >
          Sign in
        </Link>
        <Link
          href="/orders"
          className="rounded-full border border-brand-ink/20 px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink"
        >
          Orders on this device
        </Link>
      </div>
    </section>
  );
}

/*
  The customer's private order page: /orders/<id>?token=<secret>
  Only shows the order when the secret in the link matches — or, without the
  secret, when the signed-in customer owns the order.
*/
export default async function GuestOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  const secret = typeof token === "string" ? token : null;
  const order = await getGuestOrder(id, await orderKey(id, secret));
  if (!order) return <NotFound />;

  const stage = customerStage(order);
  const bank = stage === "pay_now" ? await getBankDetails() : null;
  const rejected = order.latest_payment?.status === "rejected" ? order.latest_payment : null;
  const c = order.confirmation;
  const unavailable = order.items.filter((i) => i.supplier_status === "unavailable" && !i.excluded);
  const showCancel = canCustomerCancel(order) && stage !== "your_decision";

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16" data-testid="guest-order">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">Order {order.order_number}</p>
        <h1 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl" data-testid="stage-title">
          {STAGE_TITLE[stage]}
          <span className="text-brand-red">.</span>
        </h1>
        <p className="text-sm text-brand-muted">Placed {lagos(order.placed_at)}</p>
      </div>

      {/* What's happening now */}
      <div className="rounded-3xl bg-brand-mist p-6 sm:p-8" data-testid="stage-box">
        {stage === "confirming" && order.confirmation_due_at && (
          <div className="flex flex-col gap-2">
            <p>
              RSN is checking availability with the supplier and working out your delivery fee. You&apos;ll have your
              final total by <strong>{lagos(order.confirmation_due_at)}</strong> at the latest.
            </p>
            <p className="text-sm">
              <Countdown dueAt={order.confirmation_due_at} />
            </p>
          </div>
        )}
        {stage === "confirming_late" && (
          <p>This is taking a little longer than expected. RSN will update you shortly — nothing has been charged.</p>
        )}
        {stage === "your_decision" && (
          <div className="flex flex-col gap-4">
            <p>The supplier can&apos;t supply:</p>
            <ul className="flex flex-col gap-2">
              {unavailable.map((i) => (
                <li key={i.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                  <strong>{i.name}</strong>
                  {i.size ? ` (size ${i.size})` : ""} × {i.quantity}
                  {i.supplier_note && <span className="block text-brand-muted">RSN: &ldquo;{i.supplier_note}&rdquo;</span>}
                </li>
              ))}
            </ul>
            <p className="text-sm text-brand-muted">
              Continue without them and RSN will confirm your new total, or cancel the whole order. Nothing has been
              charged.
            </p>
            <DecisionButtons orderId={order.order_id} token={secret} />
          </div>
        )}
        {stage === "pay_now" && c && (
          <div className="flex flex-col gap-4">
            <dl className="flex flex-col gap-2 text-sm" data-testid="final-total">
              <div className="flex justify-between">
                <dt>Items</dt>
                <dd>{formatNaira(Number(c.subtotal_kobo))}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Delivery to {order.delivery.city}</dt>
                <dd>{formatNaira(Number(c.delivery_fee_kobo))}</dd>
              </div>
              <div className="flex justify-between border-t border-brand-ink/10 pt-2 text-base font-semibold">
                <dt>Total to pay</dt>
                <dd>{formatNaira(Number(c.total_kobo))}</dd>
              </div>
            </dl>
            <p>
              Please pay by <strong>{lagos(c.payment_due_at)}</strong> — <Countdown dueAt={c.payment_due_at} />
            </p>
            {rejected && (
              <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark" data-testid="rejected-note">
                RSN couldn&apos;t confirm your previous transfer
                {rejected.rejection_reason ? <>: &ldquo;{rejected.rejection_reason}&rdquo;</> : "."} You can send a new
                receipt below.
              </p>
            )}
            <p className="text-sm text-brand-muted">
              Supplier stock changes quickly, so this total holds for 1 hour only.
              {order.payment_method === "paystack" && " Card payment via Paystack is coming soon — for now, please pay by bank transfer."}
            </p>
            <BankTransferPanel
              orderId={order.order_id}
              token={secret}
              orderNumber={order.order_number}
              amountText={formatNaira(Number(c.total_kobo))}
              bank={bank}
            />
          </div>
        )}
        {stage === "payment_expired" && (
          <p>
            The 1-hour payment time has passed. Because supplier stock changes quickly, RSN needs to confirm your order
            again before you can pay. RSN will be in touch — nothing has been charged.
          </p>
        )}
        {stage === "payment_review" && (
          <p>
            Thank you — we&apos;ve received your transfer receipt. RSN is checking its bank account and will confirm your
            payment shortly. Your order is prepared once the payment is confirmed.
          </p>
        )}
        {stage === "processing" && <p>Your payment is confirmed. RSN is preparing your order for delivery.</p>}
        {stage === "shipped" && <p>Your order is on its way to you.</p>}
        {stage === "delivered" && <p>Your order has been delivered. Thank you for shopping with RSN!</p>}
        {stage === "cancelled" && <p>This order has been cancelled. Nothing was charged.</p>}
        {stage === "unavailable" && <p>Sorry — the supplier couldn&apos;t supply this order, so it has been cancelled. Nothing was charged.</p>}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-3xl tracking-wide">Items</h2>
        <ul className="flex flex-col divide-y divide-brand-ink/10 rounded-3xl border border-brand-ink/10 px-5">
          {order.items.map((i) => {
            const price = i.confirmed_unit_price_kobo ?? i.unit_price_kobo;
            return (
              <li key={i.id} className={`flex justify-between gap-4 py-4 text-sm ${i.excluded ? "opacity-50" : ""}`}>
                <div>
                  <p className="font-semibold">
                    {i.name}
                    {i.excluded && <span className="ml-2 text-xs uppercase tracking-widest text-brand-red">Removed</span>}
                    {!i.excluded && i.supplier_status === "unavailable" && (
                      <span className="ml-2 text-xs uppercase tracking-widest text-brand-red">Unavailable</span>
                    )}
                  </p>
                  <p className="text-brand-muted">
                    {i.size ? `Size ${i.size} · ` : ""}Qty {i.quantity}
                  </p>
                </div>
                <p className="font-semibold">{formatNaira(Number(price) * i.quantity)}</p>
              </li>
            );
          })}
        </ul>
        {!c && <p className="text-sm text-brand-muted">Delivery fee and final total: confirmed by RSN.</p>}
      </div>

      {/* Delivery */}
      <div className="flex flex-col gap-1 text-sm">
        <h2 className="mb-2 font-display text-3xl tracking-wide">Delivery</h2>
        <p className="font-semibold">{order.delivery.name}</p>
        <p>{order.delivery.address}</p>
        <p>
          {order.delivery.city}, {order.delivery.state}
        </p>
        <p className="text-brand-muted">
          {order.delivery.phone} · {order.delivery.email}
        </p>
      </div>

      {showCancel && <CancelOrderButton orderId={order.order_id} token={secret} />}

      {secret ? (
        <p className="text-xs text-brand-muted">Keep this page&apos;s link private — anyone with it can see this order.</p>
      ) : (
        <Link href="/account" className="text-sm text-brand-muted underline underline-offset-4 hover:text-brand-red">
          Back to my orders
        </Link>
      )}
    </section>
  );
}

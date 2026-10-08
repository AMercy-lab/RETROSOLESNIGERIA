"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import BrandImage from "@/components/BrandImage";
import { BagIcon } from "@/components/icons";
import { clearCart, lineKey, useCart } from "@/lib/cart/store";
import { formatNaira } from "@/lib/format";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { saveOrder } from "@/lib/orders/saved-orders";

type Placed = { orderId: string; orderNumber: string; confirmationDueAt: string; accessToken: string };

const field =
  "w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-brand-ink aria-[invalid=true]:border-brand-red";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]";

// e.g. "Tue 3:45 pm" in Nigerian time
function lagosTime(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/*
  Checkout: delivery details + preferred payment method -> "Place order request".
  The order is created by the server (POST /api/orders) with prices taken from
  the database. Nothing is paid here: RSN first confirms availability and the
  delivery fee (within 3 hours), then the customer has 1 hour to pay.
*/
export default function CheckoutView({ defaultEmail }: { defaultEmail?: string }) {
  const { lines, count, subtotalKobo } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery: {
            name: form.get("name"),
            phone: form.get("phone"),
            email: form.get("email"),
            address: form.get("address"),
            city: form.get("city"),
            state: form.get("state"),
          },
          paymentMethod: form.get("paymentMethod"),
          items: lines.map((l) => ({ productId: l.productId, size: l.size, quantity: l.quantity })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data.error ?? "We couldn't place your order. Please try again.", field: data.field });
        return;
      }
      saveOrder({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        accessToken: data.accessToken,
        confirmationDueAt: data.confirmationDueAt,
        placedAt: new Date().toISOString(),
      });
      clearCart();
      setPlaced({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        confirmationDueAt: data.confirmationDueAt,
        accessToken: data.accessToken,
      });
      window.scrollTo({ top: 0 });
    } catch {
      setError({ message: "We couldn't reach RSN. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Order placed ----------
  if (placed) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6" data-testid="order-placed">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">Order request received</p>
        <h2 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">
          Thank you<span className="text-brand-red">.</span>
        </h2>
        <div className="rounded-3xl bg-brand-mist p-6 sm:p-8">
          <p className="text-sm text-brand-muted">Your order number</p>
          <p className="font-display text-4xl tracking-wider" data-testid="order-number">
            {placed.orderNumber}
          </p>
        </div>
        <ol className="flex flex-col gap-4">
          <li className="flex gap-4">
            <span className="font-display text-2xl text-brand-red">01</span>
            <p>
              RSN is now confirming availability with the supplier and your delivery fee — by{" "}
              <strong>{lagosTime(placed.confirmationDueAt)}</strong> at the latest (within 3 hours).
            </p>
          </li>
          <li className="flex gap-4">
            <span className="font-display text-2xl text-brand-red">02</span>
            <p>You&apos;ll then see your final total (items + delivery) and have 1 hour to pay.</p>
          </li>
          <li className="flex gap-4">
            <span className="font-display text-2xl text-brand-red">03</span>
            <p>Once your payment is confirmed, RSN prepares and delivers your order.</p>
          </li>
        </ol>
        <p className="text-sm text-brand-muted">
          Nothing has been charged. Your order page shows its progress — keep its link private. It&apos;s also saved under
          &ldquo;My orders&rdquo; on this device.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/orders/${placed.orderId}?token=${encodeURIComponent(placed.accessToken)}`}
            className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
            data-testid="view-order"
          >
            View your order
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-brand-ink/20 px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Empty cart ----------
  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-12 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-mist text-brand-red">
          <BagIcon className="h-9 w-9" />
        </span>
        <h2 className="font-display text-4xl tracking-wide">
          Your cart is empty<span className="text-brand-red">.</span>
        </h2>
        <p className="text-brand-muted">Add something to your cart before checking out.</p>
        <Link
          href="/search"
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  const invalid = (name: string) => (error?.field === name ? true : undefined);

  // ---------- Checkout form ----------
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
      {/* Order summary (first on phones, right-hand side on desktop) */}
      <aside className="flex flex-col gap-5 rounded-3xl bg-brand-mist p-5 sm:p-7 lg:sticky lg:top-32 lg:order-2">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl tracking-wide">Your order</h2>
          <Link href="/cart" className="text-xs font-semibold uppercase tracking-widest underline-offset-4 hover:text-brand-red hover:underline">
            Edit cart
          </Link>
        </div>
        <ul className="flex flex-col gap-4">
          {lines.map((line) => (
            <li key={lineKey(line)} className="flex gap-3">
              <div className="relative h-16 w-13 shrink-0 overflow-hidden rounded-xl bg-white">
                <BrandImage src={line.image} alt={line.name} sizes="52px" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold leading-snug">{line.name}</p>
                <p className="text-brand-muted">
                  {line.size ? `Size ${line.size} · ` : ""}Qty {line.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatNaira(line.priceKobo * line.quantity)}</p>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-brand-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-brand-muted">Items ({count})</dt>
            <dd className="font-semibold">{formatNaira(subtotalKobo)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-brand-muted">Delivery fee</dt>
            <dd className="text-right font-semibold" data-testid="delivery-fee">Confirmed by RSN</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-brand-ink/10 pt-2">
            <dt className="font-semibold">Final total</dt>
            <dd className="text-right font-semibold">Confirmed by RSN</dd>
          </div>
        </dl>
        <p className="text-xs text-brand-muted">
          Item prices are checked again when you place your order. You don&apos;t pay anything yet.
        </p>
      </aside>

      {/* Delivery details */}
      <form onSubmit={onSubmit} className="flex flex-col gap-8 lg:order-1" noValidate={false}>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 font-display text-3xl tracking-wide">Delivery details</legend>
          <div>
            <label htmlFor="name" className={labelClass}>Full name</label>
            <input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" className={field} aria-invalid={invalid("name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className={labelClass}>Phone number</label>
              <input id="phone" name="phone" type="tel" required inputMode="tel" autoComplete="tel" placeholder="08031234567" maxLength={20} className={field} aria-invalid={invalid("phone")} />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" maxLength={200} defaultValue={defaultEmail} className={field} aria-invalid={invalid("email")} />
            </div>
          </div>
          <div>
            <label htmlFor="address" className={labelClass}>Delivery address</label>
            <input id="address" name="address" required minLength={5} maxLength={300} autoComplete="street-address" placeholder="House number, street, area" className={field} aria-invalid={invalid("address")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className={labelClass}>City / town</label>
              <input id="city" name="city" required minLength={2} maxLength={100} autoComplete="address-level2" className={field} aria-invalid={invalid("city")} />
            </div>
            <div>
              <label htmlFor="state" className={labelClass}>State</label>
              <select id="state" name="state" required defaultValue="" autoComplete="address-level1" className={field} aria-invalid={invalid("state")}>
                <option value="" disabled>Choose your state</option>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-display text-3xl tracking-wide">How would you like to pay?</legend>
          <p className="mb-2 text-sm text-brand-muted">You&apos;ll pay after RSN confirms your order — not now.</p>
          {[
            { value: "bank_transfer", title: "Bank transfer", text: "Transfer to RSN's account and upload your receipt." },
            { value: "paystack", title: "Card or bank via Paystack", text: "Pay securely online." },
          ].map((option, i) => (
            <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-ink/15 p-4 has-[:checked]:border-brand-ink has-[:checked]:bg-brand-mist">
              <input type="radio" name="paymentMethod" value={option.value} defaultChecked={i === 0} required className="mt-1 accent-brand-red" />
              <span>
                <span className="block font-semibold">{option.title}</span>
                <span className="block text-sm text-brand-muted">{option.text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="rounded-3xl border border-brand-ink/10 p-5 text-sm sm:p-6">
          <p className="mb-2 font-semibold">What happens next</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-brand-muted">
            <li>RSN confirms availability with the supplier and your delivery fee — within 3 hours.</li>
            <li>You see your final total and have 1 hour to pay.</li>
            <li>RSN prepares and delivers your order.</li>
          </ol>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
            {error.message}
            {error.message.includes("cart") && (
              <>
                {" "}
                <Link href="/cart" className="font-semibold underline">Review cart</Link>
              </>
            )}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "Placing your order…" : "Place order request"}
        </button>
        <p className="-mt-4 text-center text-xs text-brand-muted">No payment is taken now.</p>
      </form>
    </div>
  );
}

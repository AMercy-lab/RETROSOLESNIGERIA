"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadSavedOrders, type SavedOrder } from "@/lib/orders/saved-orders";

// Orders placed on THIS device (kept in the browser), newest first.
const EMPTY: SavedOrder[] = [];
let cache: { raw: string | null; orders: SavedOrder[] } = { raw: null, orders: EMPTY };
function getSnapshot() {
  const raw = window.localStorage.getItem("rsn-orders-v1");
  if (raw !== cache.raw) cache = { raw, orders: loadSavedOrders() };
  return cache.orders;
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export default function SavedOrdersList() {
  const orders = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4" data-testid="no-saved-orders">
        <p className="text-brand-muted">No orders have been placed on this device yet.</p>
        <Link
          href="/search"
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="saved-orders">
      {orders.map((o) => (
        <li key={o.orderId}>
          <Link
            href={`/orders/${o.orderId}?token=${encodeURIComponent(o.accessToken)}`}
            className="flex items-center justify-between rounded-3xl border border-brand-ink/10 p-5 transition-colors hover:border-brand-ink/40"
          >
            <span className="font-display text-2xl tracking-wider">{o.orderNumber}</span>
            <span className="text-sm text-brand-muted">
              {new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(o.placedAt))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

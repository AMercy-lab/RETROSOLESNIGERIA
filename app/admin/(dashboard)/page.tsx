import Link from "next/link";
import Countdown from "@/components/admin/Countdown";
import StageBadge from "@/components/admin/StageBadge";
import SectionHeading from "@/components/SectionHeading";
import { TABS, listOrders, type Tab } from "@/lib/admin/orders";
import { formatNaira } from "@/lib/format";

// Placed time in Nigerian time, e.g. "Tue 6 Oct, 3:45 pm"
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

// The admin home: all orders, grouped into tabs, newest first.
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "action";
  const orders = await listOrders();
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, t.stages ? orders.filter((o) => t.stages!.includes(o.stage)).length : orders.length]),
  ) as Record<Tab, number>;
  const current = TABS.find((t) => t.id === tab)!;
  const shown = current.stages ? orders.filter((o) => current.stages!.includes(o.stage)) : orders;

  return (
    <div className="flex flex-col gap-6" data-testid="admin-home">
      <SectionHeading as="h1" eyebrow="RSN admin" title="Orders" />

      <nav aria-label="Order groups" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest ${
              t.id === tab ? "border-brand-ink bg-brand-ink text-white" : "border-brand-ink/15 hover:border-brand-red hover:text-brand-red"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${t.id === tab ? "bg-white/20" : "bg-brand-mist"}`}>{counts[t.id]}</span>
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-3xl bg-brand-mist p-8 text-center text-brand-muted" data-testid="no-orders">
          Nothing here right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="order-list">
          {shown.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/orders/${o.id}`}
                className="flex flex-col gap-3 rounded-3xl border border-brand-ink/10 bg-white p-5 transition-colors hover:border-brand-ink/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-2xl tracking-wider">{o.order_number}</span>
                    <StageBadge stage={o.stage} />
                  </div>
                  <p className="text-sm">
                    <strong>{o.delivery_name}</strong>{" "}
                    <span className="text-brand-muted">
                      · {o.delivery_city}, {o.delivery_state} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · placed {lagos(o.created_at)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-col gap-1 text-sm sm:items-end">
                  {(o.stage === "needs_confirmation" || o.stage === "confirmation_overdue") && o.confirmation_due_at && (
                    <Countdown dueAt={o.confirmation_due_at} label="To confirm" />
                  )}
                  {o.stage === "awaiting_payment" && o.paymentDueAt && <Countdown dueAt={o.paymentDueAt} label="Customer to pay" />}
                  <span className="text-brand-muted">
                    {o.stage === "needs_confirmation" || o.stage === "confirmation_overdue" || o.stage === "waiting_customer_decision"
                      ? `Items ${formatNaira(o.subtotal_kobo)} (estimate)`
                      : `Total ${formatNaira(o.total_kobo)}`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

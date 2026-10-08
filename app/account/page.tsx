import type { Metadata } from "next";
import Link from "next/link";
import CodeSignInForm from "@/components/account/CodeSignInForm";
import SectionHeading from "@/components/SectionHeading";
import { formatNaira } from "@/lib/format";
import { claimOrdersByEmail, getCustomer, listCustomerOrders } from "@/lib/customer/session";
import { customerStage, type CustomerStage } from "@/lib/orders/guest-order";
import { signOutCustomer } from "./actions";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

// Short status shown next to each order.
const STAGE_LABEL: Record<CustomerStage, string> = {
  confirming: "Confirming",
  confirming_late: "Confirming",
  your_decision: "Your decision needed",
  pay_now: "Ready to pay",
  payment_expired: "Payment time passed",
  payment_review: "Checking payment",
  processing: "Paid · being prepared",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  unavailable: "Not available",
};

function lagos(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/*
  The customer's account: sign in with an email code, then see every order
  placed with that email — on this website or in the RSN app.
*/
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const customer = await getCustomer();
  const { error } = await searchParams;

  if (!customer) {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading as="h1" eyebrow="Your account" title="Sign in" />
        <p className="text-brand-muted">
          Enter your email and we&apos;ll send you a one-time code — no password needed. Signed in, you&apos;ll see the same
          orders here and in the RSN app.
        </p>
        {error === "link" && (
          <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
            That sign-in link has expired or was opened in a different browser. Please type the code instead, or ask
            for a new one.
          </p>
        )}
        <CodeSignInForm />
        <Link href="/orders" className="text-sm text-brand-muted underline underline-offset-4 hover:text-brand-red">
          Or see orders placed on this device without signing in
        </Link>
      </section>
    );
  }

  await claimOrdersByEmail(customer.id);
  const orders = await listCustomerOrders(customer.id);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
      <div className="flex flex-col gap-2">
        <SectionHeading as="h1" eyebrow="Your account" title="My orders" />
        <p className="text-sm text-brand-muted">Signed in as {customer.email}</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-start gap-4" data-testid="no-account-orders">
          <p className="text-brand-muted">You haven&apos;t placed any orders with this email yet.</p>
          <Link
            href="/search"
            className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="account-orders">
          {orders.map((o) => {
            const total = o.confirmation?.total_kobo ?? null;
            return (
              <li key={o.order_id}>
                <Link
                  href={`/orders/${o.order_id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand-ink/10 p-5 transition-colors hover:border-brand-ink/40"
                >
                  <span className="flex flex-col">
                    <span className="font-display text-2xl tracking-wider">{o.order_number}</span>
                    <span className="text-sm text-brand-muted">{lagos(o.placed_at)}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="text-xs font-semibold uppercase tracking-widest text-brand-red">{STAGE_LABEL[customerStage(o)]}</span>
                    {total !== null && <span className="text-sm">{formatNaira(Number(total))}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <form action={signOutCustomer}>
        <button
          type="submit"
          className="text-xs font-semibold uppercase tracking-widest text-brand-muted underline underline-offset-4 transition-colors hover:text-brand-red"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}

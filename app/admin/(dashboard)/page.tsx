import SectionHeading from "@/components/SectionHeading";
import { getAdminSession } from "@/lib/admin/auth";

// The admin home. Order management (Step B) will be added here.
export default async function AdminHomePage() {
  const session = await getAdminSession();
  const email = session.status === "admin" ? session.email : null;

  return (
    <div className="flex flex-col gap-6" data-testid="admin-home">
      <SectionHeading as="h1" eyebrow="RSN admin" title="Welcome back" />
      <p className="max-w-xl text-brand-muted">
        You&apos;re signed in as <strong className="text-brand-ink">{email}</strong> with admin access.
      </p>
      <div className="rounded-3xl bg-brand-mist p-6 sm:p-8">
        <h2 className="font-display text-3xl tracking-wide">Orders</h2>
        <p className="mt-2 text-brand-muted">
          Coming next: see new orders and their 3-hour deadlines, report unavailable items, set the delivery fee and
          confirm orders.
        </p>
      </div>
    </div>
  );
}

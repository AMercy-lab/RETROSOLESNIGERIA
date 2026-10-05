import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/admin/actions";
import SectionHeading from "@/components/SectionHeading";
import { getAdminSession } from "@/lib/admin/auth";

/*
  Every page inside the admin area passes through this check ON THE SERVER:
    signed out          -> sent to the sign-in page
    signed in, no admin -> "no admin access" (nothing else is shown)
    RSN admin           -> the page
  Admin rights come from the database, not from the browser.
*/
export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (session.status === "signed-out") redirect("/admin/login");

  const signOutButton = (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-full border border-brand-ink/20 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
      >
        Sign out
      </button>
    </form>
  );

  if (session.status === "not-admin") {
    return (
      <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6 md:py-24" data-testid="no-admin-access">
        <SectionHeading as="h1" eyebrow="RSN admin" title="No admin access" />
        <p className="text-brand-muted">
          You&apos;re signed in{session.email ? ` as ${session.email}` : ""}, but this account doesn&apos;t have
          admin access.
        </p>
        <div>{signOutButton}</div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-charcoal px-5 py-3 text-white">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">
            RSN admin <span className="ml-2 font-normal normal-case tracking-normal text-white/60">{session.email}</span>
          </p>
          <nav aria-label="Admin" className="flex gap-4 text-xs font-semibold uppercase tracking-widest">
            <Link href="/admin" className="hover:text-brand-red">Orders</Link>
            <Link href="/admin/settings" className="hover:text-brand-red">Settings</Link>
          </nav>
        </div>
        <div className="[&_button]:border-white/30 [&_button]:text-white">{signOutButton}</div>
      </div>
      {children}
    </div>
  );
}

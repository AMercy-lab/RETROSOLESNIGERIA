import type { Metadata } from "next";
import Link from "next/link";
import SavedOrdersList from "@/components/orders/SavedOrdersList";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "My orders",
  robots: { index: false, follow: false },
};

// Orders placed on this device. Each opens the order's private page.
export default function MyOrdersPage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
      <SectionHeading as="h1" eyebrow="Your orders" title="My orders" />
      <SavedOrdersList />
      <p className="text-sm text-brand-muted">
        These are the orders placed on this device.{" "}
        <Link href="/account" className="underline underline-offset-4 hover:text-brand-red">
          Sign in
        </Link>{" "}
        with your email to see all your orders — from this website and the RSN app — on any device.
      </p>
    </section>
  );
}

import type { Metadata } from "next";
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
      <p className="text-xs text-brand-muted">
        Orders are remembered on the device you used to place them.
      </p>
    </section>
  );
}

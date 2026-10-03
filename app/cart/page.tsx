import type { Metadata } from "next";
import CartView from "@/components/cart/CartView";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Your cart",
};

// The cart page. The cart itself lives in the visitor's browser (see lib/cart/store.ts).
export default function CartPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <SectionHeading as="h1" eyebrow="Shopping" title="Your cart" className="mb-8 md:mb-10" />
      <CartView />
    </section>
  );
}

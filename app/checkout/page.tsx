import type { Metadata } from "next";
import CheckoutView from "@/components/checkout/CheckoutView";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Checkout",
};

/*
  Checkout: the customer enters delivery details and places an order REQUEST.
  RSN confirms availability and the delivery fee before any payment.
*/
export default function CheckoutPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <SectionHeading as="h1" eyebrow="Checkout" title="Place your order" className="mb-8 md:mb-10" />
      <CheckoutView />
    </section>
  );
}

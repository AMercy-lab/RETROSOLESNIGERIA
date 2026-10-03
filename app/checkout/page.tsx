import type { Metadata } from "next";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Checkout",
};

/*
  Checkout placeholder. "Proceed to Checkout" in the cart leads here.
  Placing an order (delivery details, RSN confirmation, payment) is built in a later stage.
*/
export default function CheckoutPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
      <SectionHeading as="h1" eyebrow="Checkout" title="Almost there" />
      <p className="text-brand-muted">
        Checkout is being built. Your cart is saved on this device, so nothing is lost.
      </p>
      <p className="text-brand-muted">
        When it&apos;s ready, you&apos;ll enter your delivery details, RSN will confirm availability and your
        delivery fee, and you&apos;ll then have one hour to pay the confirmed total.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/cart"
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
        >
          Back to cart
        </Link>
        <Link
          href="/search"
          className="rounded-full border border-brand-ink/20 px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
        >
          Continue shopping
        </Link>
      </div>
    </section>
  );
}

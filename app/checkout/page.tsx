import type { Metadata } from "next";
import Link from "next/link";
import CheckoutView from "@/components/checkout/CheckoutView";
import SectionHeading from "@/components/SectionHeading";
import { getCustomer } from "@/lib/customer/session";

export const metadata: Metadata = {
  title: "Checkout",
};

/*
  Checkout: the customer enters delivery details and places an order REQUEST.
  RSN confirms availability and the delivery fee before any payment.
  Signed-in customers get their email filled in, and the order joins their account.
*/
export default async function CheckoutPage() {
  const customer = await getCustomer();
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
      <SectionHeading as="h1" eyebrow="Checkout" title="Place your order" className="mb-8 md:mb-10" />
      <p className="mb-8 text-sm text-brand-muted" data-testid="checkout-account">
        {customer ? (
          <>Signed in as {customer.email} — this order will be saved to your account, on the website and in the RSN app.</>
        ) : (
          <>
            <Link href="/account" className="underline underline-offset-4 hover:text-brand-red">
              Sign in
            </Link>{" "}
            to see this order on all your devices, including the RSN app. Or simply continue as a guest.
          </>
        )}
      </p>
      <CheckoutView defaultEmail={customer?.email} />
    </section>
  );
}

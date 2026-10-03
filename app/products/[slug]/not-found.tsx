import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";

// Shown when a product web address doesn't match any product in the store.
export default function ProductNotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
      <SectionHeading as="h1" eyebrow="Not found" title="We couldn't find that product" />
      <p className="text-brand-muted">
        It may have been renamed or is no longer in the store. Browse what&apos;s available now — or tell RSN
        what you&apos;re looking for and we&apos;ll find it for you.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/search"
          className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
        >
          Shop all products
        </Link>
        <Link
          href="/#personal-shopper"
          className="rounded-full border border-brand-ink/20 px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
        >
          Ask RSN to find it
        </Link>
      </div>
    </section>
  );
}

"use client"; // Error pages must run in the browser

/*
  Shown if the order page can't load (e.g. the database is briefly
  unreachable). The technical error is never shown to the customer.
*/
export default function OrderError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
      <h1 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">
        Something went wrong<span className="text-brand-red">.</span>
      </h1>
      <p className="text-brand-muted">We couldn&apos;t load your order just now. Please try again in a moment.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="self-start rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
      >
        Try again
      </button>
    </section>
  );
}

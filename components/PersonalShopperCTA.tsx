import SearchForm from "@/components/SearchForm";
import { site } from "@/lib/site";

/*
  The "Tell RSN what you need" section — the heart of the personal-shopping idea.
  Used on the home page and on the search page when nothing is found.
  Later the button will open a request form (and maybe WhatsApp).
*/
export default function PersonalShopperCTA({ query }: { query?: string }) {
  return (
    <section className="bg-brand-black text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center md:py-24">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-red">
            Your personal shopper
          </p>
          <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
            Can&apos;t find what you&apos;re looking for?
          </h2>
          <p className="max-w-md text-white/70">
            {query ? (
              <>
                We don&apos;t have &ldquo;{query}&rdquo; in store right now — but that&apos;s what we&apos;re here for.{" "}
              </>
            ) : null}
            Tell {site.shortName} what you need and we&apos;ll help you find it.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <SearchForm variant="dark" placeholder="Search for an item, brand or style…" />
          <p className="text-xs uppercase tracking-widest text-white/40">
            Request form coming soon
          </p>
        </div>
      </div>
    </section>
  );
}

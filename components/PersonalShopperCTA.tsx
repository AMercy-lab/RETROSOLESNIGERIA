import Backdrop from "@/components/Backdrop";
import BrandImage from "@/components/BrandImage";
import SearchForm from "@/components/SearchForm";
import { images } from "@/lib/images";
import { site } from "@/lib/site";

/*
  The "Tell RSN what you need" section — the heart of the personal-shopping idea.
  A charcoal panel floats over a blurred, red-tinted copy of its own photo.
  Used on the home page and on the search page.
  Later the button will open a request form (and maybe WhatsApp).
*/
export default function PersonalShopperCTA({ query }: { query?: string }) {
  return (
    <section className="relative isolate overflow-hidden text-white">
      <Backdrop src={images.personalShopper.src} tint="red" />

      <div className="mx-auto max-w-7xl px-3 py-16 sm:px-6 md:py-24">
        <div className="grid gap-3 rounded-3xl border border-white/10 bg-brand-charcoal/85 p-3 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-4 md:grid-cols-2">
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl md:aspect-auto md:min-h-[440px]">
            <BrandImage
              src={images.personalShopper.src}
              alt={images.personalShopper.alt}
              label="Personal shopper"
              tone="dark"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>

          <div className="flex flex-col justify-center gap-5 px-4 py-8 sm:px-8 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">
              Your personal shopper
            </p>
            <h2 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">
              Can&apos;t find it? Tell {site.shortName}
              <span className="text-brand-red">.</span>
            </h2>
            <p className="max-w-md text-white/70">
              {query ? (
                <>
                  We don&apos;t have &ldquo;{query}&rdquo; in store right now — but that&apos;s what we&apos;re here for.{" "}
                </>
              ) : null}
              Tell {site.shortName} what you need — the exact pair, the right size, the look you have
              in mind — and we&apos;ll help you find it.
            </p>
            <SearchForm variant="dark" placeholder="Search for an item, brand or style…" />
            <p className="text-xs uppercase tracking-widest text-white/40">Request form coming soon</p>
          </div>
        </div>
      </div>
    </section>
  );
}

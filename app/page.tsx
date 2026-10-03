import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import BrandImage from "@/components/BrandImage";
import Hero from "@/components/Hero";
import PersonalShopperCTA from "@/components/PersonalShopperCTA";
import ProductCard from "@/components/ProductCard";
import ProductCarousel from "@/components/ProductCarousel";
import SectionHeading from "@/components/SectionHeading";
import TrustBar from "@/components/TrustBar";
import { ArrowIcon } from "@/components/icons";
import { getCategoryGroups, getProducts, getProductsBySlugs } from "@/lib/catalog/queries";
import { categoryHref, groupHref } from "@/lib/categories";
import { formatNaira } from "@/lib/format";
import { images } from "@/lib/images";

// Short selling points near the bottom of the page.
// PLACEHOLDER wording — edit to match what your business really offers.
const sellingPoints = [
  { number: "01", title: "Tell us what you want", text: "Browse the store or describe the exact item you're after." },
  { number: "02", title: "We source it for you", text: "RSN finds the right piece, in the right size, at a fair price." },
  { number: "03", title: "Delivered to you", text: "Your order comes straight to your door." },
];

// The products shown next to the big photo in "Get the look" (by their slug in the database).
const lookSlugs = ["heavyweight-street-tee", "washed-black-jeans", "retro-high-85"];

export default async function Home() {
  const [categoryGroups, products, lookProducts] = await Promise.all([
    getCategoryGroups(),
    getProducts(),
    getProductsBySlugs(lookSlugs),
  ]);
  // Products with photos lead the trending row; the rest follow.
  const trending = [...products].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)));

  return (
    <>
      {/* 1. HERO — floating panel over a blurred backdrop */}
      <Hero />

      {/* 2. COLLECTIONS — large photo cards floating over a dark, blurred band */}
      <section id="collections" className="relative isolate scroll-mt-32 overflow-hidden text-white">
        <Backdrop src={images.collectionsBackdrop.src} />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Collections" title="Shop the edit" />
            <p className="max-w-sm text-white/60">
              Three collections, every category. Browse by what you need — or let RSN find it for you.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {categoryGroups.map((group) => (
              <div
                key={group.slug}
                className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-3 shadow-2xl shadow-black/30 backdrop-blur-sm"
              >
                <Link href={groupHref(group.slug)} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl">
                  <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
                    <BrandImage src={group.image} alt={group.name} label={group.name} tone="dark" sizes="(min-width: 768px) 33vw, 100vw" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-linear-to-t from-black/80 via-black/30 to-transparent p-5 pt-24">
                    <div>
                      <h3 className="font-display text-5xl leading-none tracking-wide">
                        {group.name}
                        <span className="text-brand-red">.</span>
                      </h3>
                      <p className="mt-1 text-sm text-white/75">{group.tagline}</p>
                    </div>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-red transition-transform group-hover:translate-x-1">
                      <ArrowIcon />
                    </span>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2 px-1 pb-1">
                  {group.categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={categoryHref(category.slug)}
                      className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-brand-red"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. TRENDING NOW — sideways-scrolling product row */}
      <section id="trending" className="scroll-mt-32">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <ProductCarousel
            label="Trending products"
            heading={
              <div className="flex flex-col gap-4">
                <SectionHeading eyebrow="Just landed" title="Trending now" />
                <Link
                  href="/search"
                  className="flex items-center gap-2 self-start text-xs font-semibold uppercase tracking-widest transition-colors hover:text-brand-red"
                >
                  View all products <ArrowIcon />
                </Link>
              </div>
            }
          >
            {trending.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductCarousel>
        </div>
      </section>

      {/* 4. GET THE LOOK — one big outfit photo with the pieces in it */}
      <section className="bg-brand-mist">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-steel shadow-xl">
            <BrandImage
              src={images.shopTheLook.src}
              alt={images.shopTheLook.alt}
              position={images.shopTheLook.position}
              label="The look"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
              Styled by RSN
            </span>
          </div>
          <div className="flex flex-col gap-8">
            <SectionHeading eyebrow="Get the look" title="Wear it together" />
            <p className="max-w-md text-brand-muted">
              Oversized graphic layers, easy denim and a statement sneaker — one outfit, head to toe.
              Shop the pieces, or ask RSN to put a look together for you.
            </p>
            <ul className="flex flex-col divide-y divide-brand-ink/10 rounded-2xl bg-white p-2 shadow-sm">
              {lookProducts.map((product) => (
                <li key={product.id} className="flex items-center gap-4 p-3">
                  <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-brand-mist">
                    <BrandImage src={product.image} alt={product.name} sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{product.name}</p>
                    <p className="text-xs uppercase tracking-[0.15em] text-brand-muted">{product.category.name}</p>
                  </div>
                  <p className="font-semibold text-brand-red">{formatNaira(product.priceKobo)}</p>
                </li>
              ))}
            </ul>
            <Link
              href={groupHref("clothing")}
              className="self-start rounded-full bg-brand-ink px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red"
            >
              Shop clothing
            </Link>
          </div>
        </div>
      </section>

      {/* 5. FEATURE — sneakers for women */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-3 overflow-hidden rounded-3xl bg-brand-red p-3 text-white md:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-5 sm:p-9 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">For her</p>
            <h2 className="font-display text-6xl leading-[0.9] tracking-wide sm:text-7xl">
              Sneakers for her, too<span className="text-brand-ink">.</span>
            </h2>
            <p className="max-w-sm text-white/85">
              Clean classics and statement pairs, sized and sourced for women.
            </p>
            <Link
              href={categoryHref("sneakers")}
              className="mt-2 self-start rounded-full bg-white px-8 py-4 text-xs font-semibold uppercase tracking-widest text-brand-ink transition-colors hover:bg-brand-ink hover:text-white"
            >
              Shop sneakers
            </Link>
          </div>
          <div className="relative aspect-[5/4] overflow-hidden rounded-2xl bg-brand-steel md:aspect-auto md:min-h-[420px]">
            <BrandImage
              src={images.sneakersForHer.src}
              alt={images.sneakersForHer.alt}
              fit={images.sneakersForHer.fit}
              label="Sneakers"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
        </div>
      </section>

      {/* 6. TRUST BAR */}
      <TrustBar />

      {/* 7. PERSONAL SHOPPER — "Can't find it? Tell RSN" */}
      <div id="personal-shopper" className="scroll-mt-32">
        <PersonalShopperCTA />
      </div>

      {/* 8. HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="How RSN works" title="Shopping, sorted" className="mb-10" />
        <div className="grid gap-10 md:grid-cols-3">
          {sellingPoints.map((point) => (
            <div key={point.number} className="flex flex-col gap-3 border-t-2 border-brand-ink pt-6">
              <span className="font-display text-3xl text-brand-red">{point.number}</span>
              <h3 className="font-display text-3xl tracking-wide">{point.title}</h3>
              <p className="text-brand-muted">{point.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import BrandImage from "@/components/BrandImage";
import PersonalShopperCTA from "@/components/PersonalShopperCTA";
import ProductCard from "@/components/ProductCard";
import WelcomeGreeting from "@/components/WelcomeGreeting";
import { ArrowIcon } from "@/components/icons";
import { categoryGroups, categoryHref, groupHref } from "@/lib/categories";
import { products } from "@/lib/products";

// Short selling points near the bottom of the page.
// PLACEHOLDER wording — edit to match what your business really offers.
const sellingPoints = [
  { number: "01", title: "Tell us what you want", text: "Browse the store or describe the exact item you're after." },
  { number: "02", title: "We source it for you", text: "RSN finds the right piece, in the right size, at a fair price." },
  { number: "03", title: "Delivered to you", text: "Your order comes straight to your door." },
];

export default function Home() {
  // Every category from every collection, for the "quick shop" strip.
  const allCategories = categoryGroups.flatMap((group) => group.categories);

  return (
    <>
      {/* 1. HERO */}
      <section className="bg-brand-black text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="flex flex-col gap-6">
            {/* Later: firstName will come from the signed-in customer's Google account */}
            <WelcomeGreeting firstName={null} />
            <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tight sm:text-6xl lg:text-7xl">
              Personal shopping <span className="text-brand-red">made easy.</span>
            </h1>
            <p className="max-w-md text-base text-white/70 sm:text-lg">
              Sneakers, sharp shoes, streetwear and corporate fits — picked for you,
              delivered to you.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="#new-arrivals"
                className="bg-brand-red px-8 py-4 text-center text-sm font-bold uppercase tracking-widest transition-colors hover:bg-brand-red-dark"
              >
                Shop new arrivals
              </Link>
              <Link
                href="#personal-shopper"
                className="border border-white/40 px-8 py-4 text-center text-sm font-bold uppercase tracking-widest transition-colors hover:border-white hover:bg-white hover:text-brand-black"
              >
                Tell us what you need
              </Link>
            </div>
          </div>

          {/* Hero image area — replace with a real campaign photo later via src="/images/hero.jpg" */}
          <div className="relative">
            <div className="absolute -bottom-3 -right-3 h-full w-full bg-brand-red sm:-bottom-4 sm:-right-4" aria-hidden="true" />
            <div className="relative aspect-[4/5] overflow-hidden md:aspect-[5/6]">
              <BrandImage tone="dark" alt="RETROSOLESNIGERIA featured look" label="New season" priority sizes="(min-width: 768px) 50vw, 100vw" />
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK SHOP — every category as a tappable chip; scrolls sideways on phones */}
      <section aria-label="Quick shop" className="border-b border-brand-black/10">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-5 sm:px-6">
          {allCategories.map((category) => (
            <Link
              key={category.slug}
              href={categoryHref(category.slug)}
              className="shrink-0 border border-brand-black/15 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors hover:border-brand-red hover:bg-brand-red hover:text-white"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      {/* 3. COLLECTIONS — one big tile per collection, with its categories underneath */}
      <section id="collections" className="mx-auto max-w-7xl scroll-mt-32 px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-red">Collections</p>
          <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Shop the edit</h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-6">
          {categoryGroups.map((group) => (
            <div key={group.slug} className="flex flex-col gap-5">
              <Link href={groupHref(group.slug)} className="group relative block aspect-[3/4] overflow-hidden">
                <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
                  <BrandImage src={group.image} alt={group.name} label={group.name} sizes="(min-width: 768px) 33vw, 100vw" />
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-linear-to-t from-brand-black/80 to-transparent p-6 pt-20 text-white">
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tight">{group.name}</h3>
                    <p className="text-sm text-white/80">{group.tagline}</p>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-brand-red transition-transform group-hover:translate-x-1">
                    <ArrowIcon />
                  </span>
                </div>
              </Link>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {group.categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={categoryHref(category.slug)}
                    className="text-sm text-brand-muted underline-offset-4 transition-colors hover:text-brand-red hover:underline"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. NEW ARRIVALS — 2 columns on phones, 4 on desktop */}
      <section id="new-arrivals" className="scroll-mt-32 bg-brand-cream">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-red">Just landed</p>
              <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">New arrivals</h2>
            </div>
            <Link
              href="/search"
              className="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-brand-red"
            >
              View all <ArrowIcon />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. FEATURE BANNER — sneakers for women */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid overflow-hidden bg-brand-red text-white md:grid-cols-2">
          <div className="flex flex-col justify-center gap-5 p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/80">For her</p>
            <h2 className="text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-5xl">
              Sneakers for her, too.
            </h2>
            <p className="max-w-sm text-white/85">
              Clean classics and statement pairs, sized and sourced for women.
            </p>
            <Link
              href={categoryHref("sneakers")}
              className="mt-2 self-start bg-white px-8 py-4 text-sm font-bold uppercase tracking-widest text-brand-black transition-colors hover:bg-brand-black hover:text-white"
            >
              Shop sneakers
            </Link>
          </div>
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px]">
            <BrandImage tone="dark" alt="Women's sneakers" label="Sneakers" sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      {/* 6. PERSONAL SHOPPER — "Can't find it? Tell RSN" */}
      <div id="personal-shopper" className="scroll-mt-32">
        <PersonalShopperCTA />
      </div>

      {/* 7. HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mb-10 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-red">How RSN works</p>
          <h2 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">Shopping, sorted</h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3">
          {sellingPoints.map((point) => (
            <div key={point.number} className="flex flex-col gap-3 border-t-2 border-brand-black pt-6">
              <span className="text-sm font-black text-brand-red">{point.number}</span>
              <h3 className="text-xl font-black uppercase tracking-tight">{point.title}</h3>
              <p className="text-brand-muted">{point.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

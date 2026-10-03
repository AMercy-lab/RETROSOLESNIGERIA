import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/product/ProductGallery";
import ProductPurchasePanel from "@/components/product/ProductPurchasePanel";
import { ArrowLeftIcon } from "@/components/icons";
import { AVAILABILITY_OPTIONS } from "@/lib/catalog/availability";
import { getProductBySlug, getProducts } from "@/lib/catalog/queries";
import { categoryHref, groupHref } from "@/lib/categories";
import { formatNaira } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

// Pre-build a page for every current product; new products are built on first visit.
export async function generateStaticParams() {
  return (await getProducts()).map((product) => ({ slug: product.slug }));
}

// Page title and description come from the product itself.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Product not found" };

  const description = [
    product.description,
    `${formatNaira(product.priceKobo)}.`,
    product.availabilityLabel ? `Availability: ${product.availabilityLabel}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 160);

  return {
    title: product.name,
    description,
    openGraph: { title: product.name, description },
  };
}

/*
  The product page: /products/<slug>
  All information comes from the live Supabase catalogue.
*/
export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const availability = AVAILABILITY_OPTIONS.find((option) => option.value === product.availability);
  const backHref = categoryHref(product.category.slug);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 md:pt-10">
      {/* Breadcrumb: the way back to the right shopping page */}
      <nav aria-label="Breadcrumb" className="mb-6 md:mb-8">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-muted">
          <li>
            <Link href="/" className="hover:text-brand-red">Home</Link>
          </li>
          {product.group && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={groupHref(product.group.slug)} className="hover:text-brand-red">
                  {product.group.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li>
            <Link href={backHref} className="hover:text-brand-red">
              {product.category.name}
            </Link>
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="md:sticky md:top-32 md:self-start">
          <ProductGallery images={product.images} alt={product.name} placeholderLabel={product.category.name} />
        </div>

        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">{product.category.name}</p>
              {product.tag && (
                <span className="rounded-full bg-brand-red px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
                  {product.tag}
                </span>
              )}
              {product.audience === "women" && (
                <span className="rounded-full bg-brand-mist px-3 py-1 text-[11px] font-semibold uppercase tracking-widest">
                  Women
                </span>
              )}
            </div>
            <h1 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">{product.name}</h1>
            <p className="text-2xl font-semibold text-brand-red">{formatNaira(product.priceKobo)}</p>
          </div>

          {availability && (
            <div className="rounded-2xl bg-brand-mist p-5">
              <p data-testid="pdp-availability">
                <span className="text-brand-muted">Availability:</span>{" "}
                <span className="font-semibold">{availability.label}</span>
              </p>
              <p className="mt-1 text-sm text-brand-muted">{availability.meaning}</p>
            </div>
          )}

          <ProductPurchasePanel product={product} />

          <p className="text-sm text-brand-muted">
            Adding to your cart doesn&apos;t commit you to anything. When you place your order, RSN confirms
            supplier availability and your delivery fee before you pay.
          </p>

          {product.description && (
            <div className="flex flex-col gap-2 border-t border-brand-ink/10 pt-6">
              <h2 className="font-display text-2xl tracking-wider">Details</h2>
              <p className="leading-relaxed text-brand-ink/80">{product.description}</p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-brand-ink/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={backHref}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-colors hover:text-brand-red"
            >
              <ArrowLeftIcon /> Back to {product.category.name}
            </Link>
            <Link
              href="/#personal-shopper"
              className="text-xs font-semibold uppercase tracking-widest text-brand-muted underline-offset-4 transition-colors hover:text-brand-red hover:underline"
            >
              Need another size or colour? Ask RSN
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

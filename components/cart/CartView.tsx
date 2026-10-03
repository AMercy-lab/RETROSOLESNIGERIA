"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandImage from "@/components/BrandImage";
import { ArrowIcon, BagIcon } from "@/components/icons";
import type { Product } from "@/lib/catalog/types";
import { formatNaira } from "@/lib/format";
import { MAX_QUANTITY, lineKey, refreshLines, removeLine, setLineQuantity, useCart } from "@/lib/cart/store";

type LineIssue = "unavailable" | "size";

/*
  The cart page contents.
  On opening, every line is checked against the LIVE catalogue (Supabase):
    - names, prices and photos are refreshed (a changed price is flagged),
    - products no longer sold, or sizes no longer offered, are flagged and
      must be removed before checkout.
*/
export default function CartView() {
  const { lines, count, subtotalKobo } = useCart();
  const [issues, setIssues] = useState<Record<string, LineIssue>>({});
  const [priceChanged, setPriceChanged] = useState<Set<string>>(new Set());

  // Refresh the cart from the live catalogue once per visit to the page.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog/products")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(({ products }: { products: Product[] }) => {
        if (cancelled) return;
        const byId = new Map(products.map((p) => [p.id, p]));
        const found: Record<string, LineIssue> = {};
        const changed = new Set<string>();

        refreshLines((line) => {
          const key = lineKey(line);
          const product = byId.get(line.productId);
          if (!product) {
            found[key] = "unavailable";
            return line;
          }
          const sizeOk = product.sizes.length === 0 ? line.size === null : line.size !== null && product.sizes.includes(line.size);
          if (!sizeOk) found[key] = "size";
          if (product.priceKobo !== line.priceKobo) changed.add(key);
          return {
            ...line,
            name: product.name,
            slug: product.slug,
            categoryName: product.category.name,
            image: product.image,
            priceKobo: product.priceKobo,
            availability: product.availability,
            availabilityLabel: product.availabilityLabel,
          };
        });
        setIssues(found);
        setPriceChanged(changed);
      })
      .catch(() => {
        // Catalogue unreachable: show the cart as saved; checkout re-checks everything anyway.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (lines.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-mist text-brand-red">
          <BagIcon className="h-9 w-9" />
        </span>
        <h2 className="font-display text-4xl tracking-wide">
          Your cart is empty<span className="text-brand-red">.</span>
        </h2>
        <p className="text-brand-muted">
          Browse sneakers, shoes, clothing and accessories — or tell RSN what you&apos;re looking for.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/search"
            className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
          >
            Continue shopping
          </Link>
          <Link
            href="/#personal-shopper"
            className="rounded-full border border-brand-ink/20 px-8 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
          >
            Ask RSN to find it
          </Link>
        </div>
      </div>
    );
  }

  // Only lines still in the cart can block checkout (a removed line's warning no longer counts).
  const blocked = lines.some((line) => issues[lineKey(line)] !== undefined);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      {/* Cart lines */}
      <ul className="flex flex-col divide-y divide-brand-ink/10 rounded-3xl border border-brand-ink/10 bg-white px-4 sm:px-6">
        {lines.map((line) => {
          const key = lineKey(line);
          const issue = issues[key];
          return (
            <li key={key} className="flex gap-4 py-5 sm:gap-6">
              <div className="relative h-28 w-22 shrink-0 overflow-hidden rounded-2xl bg-brand-mist sm:h-32 sm:w-26">
                <BrandImage src={line.image} alt={line.name} sizes="104px" />
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.15em] text-brand-muted">{line.categoryName}</p>
                    <h3 className="font-semibold leading-snug">{line.name}</h3>
                    {line.size && <p className="text-sm text-brand-muted">Size: {line.size}</p>}
                    <p className="text-sm text-brand-muted">
                      {formatNaira(line.priceKobo)} each
                      {priceChanged.has(key) && <span className="ml-2 font-semibold text-brand-red">Price updated</span>}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold">{formatNaira(line.priceKobo * line.quantity)}</p>
                </div>

                {issue && (
                  <p role="alert" className="rounded-xl bg-brand-red/10 px-3 py-2 text-sm text-brand-red-dark">
                    {issue === "unavailable"
                      ? "This product is no longer available. Please remove it to continue."
                      : "This size is no longer offered. Please remove it and choose another size."}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center rounded-full border border-brand-ink/15">
                    <button
                      type="button"
                      onClick={() => setLineQuantity(key, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label={`Decrease quantity of ${line.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLineQuantity(key, line.quantity + 1)}
                      disabled={line.quantity >= MAX_QUANTITY}
                      aria-label={`Increase quantity of ${line.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(key)}
                    className="text-xs font-semibold uppercase tracking-widest text-brand-muted underline-offset-4 transition-colors hover:text-brand-red hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary */}
      <aside className="flex flex-col gap-5 rounded-3xl bg-brand-mist p-6 sm:p-8 lg:sticky lg:top-32">
        <h2 className="font-display text-3xl tracking-wide">Summary</h2>
        <div className="flex items-center justify-between">
          <span className="text-brand-muted">
            Subtotal ({count} item{count === 1 ? "" : "s"})
          </span>
          <span className="text-lg font-semibold">{formatNaira(subtotalKobo)}</span>
        </div>
        <p className="text-sm text-brand-muted">
          RSN confirms availability and your delivery fee before you pay. You&apos;ll see the final total then.
        </p>
        {blocked ? (
          <span
            aria-disabled="true"
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-full bg-brand-ink/20 px-6 py-4 text-xs font-semibold uppercase tracking-widest text-white"
          >
            Remove unavailable items to continue
          </span>
        ) : (
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
          >
            Proceed to Checkout <ArrowIcon />
          </Link>
        )}
        <Link
          href="/search"
          className="text-center text-xs font-semibold uppercase tracking-widest underline-offset-4 transition-colors hover:text-brand-red hover:underline"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}

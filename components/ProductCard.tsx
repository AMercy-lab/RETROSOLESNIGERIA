import Link from "next/link";
import BrandImage from "@/components/BrandImage";
import AddToCartButton from "@/components/cart/AddToCartButton";
import type { Product } from "@/lib/catalog/types";
import { formatNaira } from "@/lib/format";

/*
  One product box: image, label, name, category and price.
  The photo sits on the same soft grey as the page sections, so studio
  shots blend into the layout.
  The photo and name open the product's own page (/products/<slug>).
  "Add to cart" (or "Choose size" for products with sizes) sits OUTSIDE that
  link, so using it never opens the product page.
*/
export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col gap-3">
      <Link
        href={`/products/${product.slug}`}
        className="flex flex-col gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-red"
      >
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-mist">
          <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
            <BrandImage src={product.image} alt={product.name} label={product.category.name} />
          </div>
          {product.tag && (
            <span className="absolute left-3 top-3 rounded-full bg-brand-red px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white">
              {product.tag}
            </span>
          )}
          {product.audience === "women" && (
            <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-brand-ink">
              Women
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-1">
          <h3 className="font-semibold leading-snug underline-offset-4 group-hover:underline">{product.name}</h3>
          <p className="text-xs uppercase tracking-[0.15em] text-brand-muted">{product.category.name}</p>
          <p className="mt-1.5 font-semibold text-brand-red">{formatNaira(product.priceKobo)}</p>
        </div>
      </Link>
      <div className="mt-auto px-1">
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}

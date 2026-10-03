import BrandImage from "@/components/BrandImage";
import type { Product } from "@/lib/catalog/types";
import { formatNaira } from "@/lib/format";

/*
  One product box: image, label, name, category and price.
  The photo sits on the same soft grey as the page sections, so studio
  shots blend into the layout.
  Later this will link to the product's own page and get an "Add to cart" button.
*/
export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col gap-3">
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
        <h3 className="font-semibold leading-snug">{product.name}</h3>
        <p className="text-xs uppercase tracking-[0.15em] text-brand-muted">{product.category.name}</p>
        <p className="mt-1.5 font-semibold text-brand-red">{formatNaira(product.priceKobo)}</p>
      </div>
    </article>
  );
}

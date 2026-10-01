import BrandImage from "@/components/BrandImage";
import { categoryName, formatNaira, type Product } from "@/lib/products";

/*
  One product box: image, label, category, name and price.
  Later this will link to the product's own page and get an "Add to cart" button.
*/
export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex flex-col gap-4">
      <div className="relative aspect-[4/5] overflow-hidden bg-brand-cream">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <BrandImage src={product.image} alt={product.name} label={categoryName(product)} />
        </div>
        {product.tag && (
          <span className="absolute left-3 top-3 bg-brand-red px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            {product.tag}
          </span>
        )}
        {product.audience === "women" && (
          <span className="absolute right-3 top-3 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-black">
            Women
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-muted">{categoryName(product)}</p>
        <h3 className="font-bold leading-snug">{product.name}</h3>
        <p className="font-bold text-brand-red">{formatNaira(product.price)}</p>
      </div>
    </article>
  );
}

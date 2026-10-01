import { findCategory } from "@/lib/categories";
import { products, type Product } from "@/lib/products";

/*
  Simple search over the sample products.
  A product matches when EVERY word typed appears somewhere in its
  name, description or category name (capital letters ignored).
  Later this will be replaced by a database search.
*/
export function searchProducts(options: {
  query?: string;
  category?: string;
  group?: string;
}): Product[] {
  const words = (options.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);

  return products.filter((product) => {
    const found = findCategory(product.category);

    if (options.category && product.category !== options.category) return false;
    if (options.group && found?.group.slug !== options.group) return false;

    const text = `${product.name} ${product.description} ${found?.name ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

import "server-only";
import { cache } from "react";
import { availabilityLabel, isProductAvailability } from "@/lib/catalog/availability";
import { findCategory } from "@/lib/categories";
import { demoCategoryImages, demoProductImages } from "@/lib/images";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category, CategoryGroup, Product } from "@/lib/catalog/types";

/*
  CATALOGUE DATA ACCESS — the single place that reads categories and products
  from Supabase. Website pages call these functions directly; the API routes
  in app/api/catalog/ expose the same functions to the future mobile app.

  Everything here uses the public (signed-out) connection, so the database
  security rules only ever return ACTIVE categories and products.
*/

// Public web address of a file in the "catalog-images" storage bucket
function storageImageUrl(path: string) {
  const { url } = getSupabaseEnv();
  return `${url}/storage/v1/object/public/catalog-images/${path.split("/").map(encodeURIComponent).join("/")}`;
}

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  tagline: string | null;
  image_path: string | null;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_kobo: number;
  // Optional (?) so the site keeps working until migration 20261004090000 has been run.
  availability?: string;
  sizes?: string[];
  audience: Product["audience"];
  tag: string | null;
  keywords: string[];
  category_id: string;
  product_images: { storage_path: string; sort_order: number }[];
};

// "*" = every product column the database has; stock_quantity is read but never passed on.
const PRODUCT_COLUMNS = "*, product_images(storage_path, sort_order)";

/*
  All active top-level categories with their subcategories, in display order.
  cache() means several components asking during the same page load share one database call.
*/
export const getCategoryGroups = cache(async (): Promise<CategoryGroup[]> => {
  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, parent_id, name, slug, tagline, image_path")
    .order("sort_order")
    .order("name")
    .overrideTypes<CategoryRow[], { merge: false }>();

  if (error) throw new Error(`Could not load categories: ${error.message}`);

  return data
    .filter((row) => row.parent_id === null)
    .map((top) => ({
      id: top.id,
      name: top.name,
      slug: top.slug,
      tagline: top.tagline,
      image: top.image_path ? storageImageUrl(top.image_path) : demoCategoryImages[top.slug],
      categories: data
        .filter((row) => row.parent_id === top.id)
        .map(({ id, name, slug }) => ({ id, name, slug })),
    }));
});

// Turns a database row into the Product shape the website uses.
function toProduct(row: ProductRow, groups: CategoryGroup[]): Product | null {
  let category: Category | undefined;
  let group: Category | null = null;

  for (const g of groups) {
    if (g.id === row.category_id) {
      category = { id: g.id, name: g.name, slug: g.slug };
      break;
    }
    const sub = g.categories.find((c) => c.id === row.category_id);
    if (sub) {
      category = sub;
      group = { id: g.id, name: g.name, slug: g.slug };
      break;
    }
  }
  // Products in a hidden (inactive) category are not shown.
  if (!category) return null;

  const mainImage = [...row.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceKobo: Number(row.price_kobo),
    availability: isProductAvailability(row.availability) ? row.availability : null,
    availabilityLabel: isProductAvailability(row.availability) ? availabilityLabel(row.availability) : null,
    sizes: row.sizes ?? [],
    audience: row.audience,
    tag: row.tag,
    keywords: row.keywords,
    category,
    group,
    image: mainImage ? storageImageUrl(mainImage.storage_path) : demoProductImages[row.slug],
  };
}

// All active products, newest first.
export const getProducts = cache(async (): Promise<Product[]> => {
  const [groups, result] = await Promise.all([
    getCategoryGroups(),
    createPublicClient()
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("created_at", { ascending: false })
      .order("name")
      .overrideTypes<ProductRow[], { merge: false }>(),
  ]);

  if (result.error) throw new Error(`Could not load products: ${result.error.message}`);

  return result.data.map((row) => toProduct(row, groups)).filter((p): p is Product => p !== null);
});

// Specific products, in the order the slugs are given (missing ones are skipped).
export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  const products = await getProducts();
  return slugs
    .map((slug) => products.find((p) => p.slug === slug))
    .filter((p): p is Product => p !== undefined);
}

/*
  Search and filter the catalogue.
  A product matches when EVERY word typed appears somewhere in its name,
  description, keywords, category or top-level category (capital letters ignored).
  "category" narrows to one subcategory, "group" to one top-level category.

  The catalogue is small, so filtering happens here on the server. When it
  grows large, this can move into a database search without changing callers.
*/
export async function searchProducts(options: {
  query?: string;
  category?: string;
  group?: string;
}): Promise<Product[]> {
  const words = (options.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const products = await getProducts();

  return products.filter((product) => {
    if (options.category && product.category.slug !== options.category) return false;
    if (options.group && product.group?.slug !== options.group && product.category.slug !== options.group) {
      return false;
    }

    const text = [
      product.name,
      product.description,
      product.keywords.join(" "),
      product.category.name,
      product.group?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

// Looks up a category or collection by slug in the live category list.
export async function getCategoryBySlug(slug: string) {
  return findCategory(await getCategoryGroups(), slug);
}

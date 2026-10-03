import type { Category, CategoryGroup } from "@/lib/catalog/types";

/*
  Helpers for working with the category list.
  The categories themselves now live in the Supabase "categories" table
  (loaded by getCategoryGroups() in lib/catalog/queries.ts).
*/

// Finds a subcategory by its slug, e.g. "sneakers" -> { name: "Sneakers", group: Shoes, ... }
// Also accepts a top-level slug such as "shoes".
export function findCategory(
  groups: CategoryGroup[],
  slug: string,
): (Category & { group: CategoryGroup | null }) | undefined {
  for (const group of groups) {
    if (group.slug === slug) return { id: group.id, name: group.name, slug: group.slug, group: null };
    const category = group.categories.find((c) => c.slug === slug);
    if (category) return { ...category, group };
  }
  return undefined;
}

// Finds a top-level collection by its slug, e.g. "shoes"
export function findGroup(groups: CategoryGroup[], slug: string) {
  return groups.find((g) => g.slug === slug);
}

/*
  The web address for a collection or category.
  For now these open the search page filtered to that category.
  When we build dedicated category pages later, we only change these two lines.
*/
export const groupHref = (slug: string) => `/search?group=${slug}`;
export const categoryHref = (slug: string) => `/search?category=${slug}`;

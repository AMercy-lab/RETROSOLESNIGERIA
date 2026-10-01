/*
  The store's categories, grouped into collections.

  To add a category: add a { name, slug } line to a group's list.
  To add a whole new collection: copy one group block and edit it.
  A "slug" is the short, web-address-friendly version of a name,
  e.g. "Corporate Shirts" -> "corporate-shirts". Every slug must be unique.
*/

export type Category = {
  name: string;
  slug: string;
};

export type CategoryGroup = {
  name: string;
  slug: string;
  tagline: string;
  image?: string; // e.g. "/images/collections/shoes.jpg" — add later
  categories: Category[];
};

export const categoryGroups: CategoryGroup[] = [
  {
    name: "Shoes",
    slug: "shoes",
    tagline: "From statement sneakers to sharp brogues.",
    categories: [
      { name: "Sneakers", slug: "sneakers" },
      { name: "Brogues", slug: "brogues" },
      { name: "Boots", slug: "boots" },
      { name: "Sandals", slug: "sandals" },
      { name: "Slides", slug: "slides" },
    ],
  },
  {
    name: "Clothing",
    slug: "clothing",
    tagline: "Boardroom-ready to street-ready.",
    categories: [
      { name: "Corporate Shirts", slug: "corporate-shirts" },
      { name: "Street T-Shirts", slug: "street-t-shirts" },
      { name: "Jeans Trousers", slug: "jeans-trousers" },
      { name: "Pant Trousers", slug: "pant-trousers" },
      { name: "Jerseys", slug: "jerseys" },
    ],
  },
  {
    name: "Accessories",
    slug: "accessories",
    tagline: "The details that finish the fit.",
    categories: [
      { name: "Socks", slug: "socks" },
      { name: "Caps", slug: "caps" },
      { name: "Jewellery", slug: "jewellery" },
    ],
  },
];

// Finds a category by its slug, e.g. "sneakers" -> { name: "Sneakers", ... }
export function findCategory(slug: string) {
  for (const group of categoryGroups) {
    const category = group.categories.find((c) => c.slug === slug);
    if (category) return { ...category, group };
  }
  return undefined;
}

// Finds a collection by its slug, e.g. "shoes"
export function findGroup(slug: string) {
  return categoryGroups.find((g) => g.slug === slug);
}

/*
  The web address for a collection or category.
  For now these open the search page filtered to that category.
  When we build dedicated category pages later, we only change these two lines.
*/
export const groupHref = (slug: string) => `/search?group=${slug}`;
export const categoryHref = (slug: string) => `/search?category=${slug}`;

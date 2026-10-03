/*
  The shapes of catalogue data as the website (and later the mobile app)
  uses it. They are built from the database rows in lib/catalog/queries.ts.
  Money is in kobo (₦85,000 = 8,500,000) — use formatNaira() to display it.
  Stock quantities are deliberately NOT included: RSN sources from suppliers,
  so customers see the availability status instead.
*/
import type { ProductAvailability } from "@/lib/catalog/availability";

export type Category = {
  id: string;
  name: string;
  slug: string;
};

// A top-level category (Shoes, Clothing, Accessories) with its subcategories.
export type CategoryGroup = Category & {
  tagline: string | null;
  image?: string; // photo URL, if one is set
  categories: Category[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceKobo: number;
  // One status for the whole product, e.g. "confirm_to_purchase" / "Confirm to purchase".
  // null only if the availability migration hasn't been applied to the database yet.
  availability: ProductAvailability | null;
  availabilityLabel: string | null;
  // Optional sizes in display order, e.g. ["40", "41"] or ["S", "M"]; empty = no sizes.
  sizes: string[];
  audience: "men" | "women" | "unisex";
  tag: string | null; // optional label such as "New" or "Hot"
  keywords: string[];
  category: Category; // the most specific category, e.g. Sneakers
  group: Category | null; // its top-level category, e.g. Shoes
  image?: string; // main photo URL, if one is set
  images: string[]; // all photos in display order (the main photo first); may be empty
};

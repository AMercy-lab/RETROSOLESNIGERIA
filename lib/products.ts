import { findCategory } from "@/lib/categories";

/*
  SAMPLE products, used until we connect a real database.
  Change them freely — the pages update automatically. Prices are in Naira.
  "category" must match a slug in lib/categories.ts.
*/

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  price: number;
  audience: "men" | "women" | "unisex";
  tag?: string; // optional label such as "New" or "Hot"
  image?: string; // e.g. "/images/products/retro-high-85.jpg" — add later
};

export const products: Product[] = [
  {
    id: "1",
    slug: "retro-high-85",
    name: "Retro High '85",
    description: "High-top leather sneaker with a padded collar and a bold red sole.",
    category: "sneakers",
    price: 85000,
    audience: "unisex",
    tag: "New",
  },
  {
    id: "2",
    slug: "oxford-wingtip-brogue",
    name: "Oxford Wingtip Brogue",
    description: "Classic tan leather brogue for the office, weddings and owambe.",
    category: "brogues",
    price: 72000,
    audience: "men",
  },
  {
    id: "3",
    slug: "heavyweight-street-tee",
    name: "Heavyweight Street Tee",
    description: "Oversized cotton t-shirt with a boxy fit. Everyday streetwear essential.",
    category: "street-t-shirts",
    price: 18000,
    audience: "men",
    tag: "Hot",
  },
  {
    id: "4",
    slug: "everyday-slide",
    name: "Everyday Slide",
    description: "Cushioned rubber slide for home, the beach and quick runs.",
    category: "slides",
    price: 22000,
    audience: "unisex",
  },
  {
    id: "5",
    slug: "classic-white-court",
    name: "Classic White Court",
    description: "Clean all-white low-top sneaker that goes with everything.",
    category: "sneakers",
    price: 68000,
    audience: "women",
    tag: "New",
  },
  {
    id: "6",
    slug: "slim-fit-corporate-shirt",
    name: "Slim-Fit Corporate Shirt",
    description: "Crisp cotton office shirt with a tailored slim fit.",
    category: "corporate-shirts",
    price: 24000,
    audience: "men",
  },
  {
    id: "7",
    slug: "washed-black-jeans",
    name: "Washed Black Jeans",
    description: "Straight-leg denim trousers in a faded black wash.",
    category: "jeans-trousers",
    price: 35000,
    audience: "men",
  },
  {
    id: "8",
    slug: "street-logo-cap",
    name: "Street Logo Cap",
    description: "Structured six-panel baseball cap with an adjustable strap.",
    category: "caps",
    price: 12000,
    audience: "unisex",
    tag: "Hot",
  },
];

// The human-readable category name for a product, e.g. "Sneakers"
export function categoryName(product: Product) {
  return findCategory(product.category)?.name ?? product.category;
}

// Turns 85000 into "₦85,000"
export function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

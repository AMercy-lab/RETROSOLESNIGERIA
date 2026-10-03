/*
  SITE IMAGES — every photo used on the site outside the product and
  collection lists lives here, so you can swap them in one place.

  ⚠ TEMPORARY: everything under /public/demo/ was cropped from design
  reference screenshots so the store looks realistic on localhost.
  They do NOT belong to RSN and must be replaced before the site goes live.

  To replace an image, either:
    1. put your photo in /public (e.g. /public/images/hero.png) and change
       its "src" below, or
    2. save your photo over the demo file using the same name.

  Product and collection photos are listed at the bottom of this file.
  A photo uploaded to Supabase Storage for a product or category always takes
  priority over these. Leave any "src" empty ("") to show the styled
  placeholder instead.

  "position" (optional) chooses which part of the photo stays visible when it
  is cropped to fit, e.g. "center top" or "70% 50%".
  "fit" (optional): "contain" shows the whole photo instead of filling the box.
*/

export type SiteImage = {
  src: string;
  alt: string;
  position?: string;
  fit?: "cover" | "contain";
};

export const images = {
  // The model in the hero. Works best as a PNG with a transparent background
  // (a cut-out), standing upright with feet at the bottom of the image.
  hero: {
    src: "/demo/hero-model.png",
    alt: "Model walking in a long coat, cap and sneakers",
  },
  // Blurred, tinted atmosphere behind the hero panel. Any photo works — it is blurred heavily.
  heroBackdrop: {
    src: "/demo/hero-backdrop.jpg",
    alt: "",
  },
  // Blurred atmosphere behind the collections band.
  collectionsBackdrop: {
    src: "/demo/collection-shoes.jpg",
    alt: "",
  },
  // Large outfit photo in the "Shop the look" section.
  shopTheLook: {
    src: "/demo/shop-the-look.jpg",
    alt: "Model in an oversized graphic sweatshirt and light-wash jeans",
    position: "center top",
  },
  // The "Sneakers for her" feature.
  sneakersForHer: {
    src: "/demo/product-classic-white-court.jpg",
    alt: "White chunky sneaker on a skateboard",
    // The demo photo is small, so show all of it; use "cover" for a large photo.
    fit: "contain",
  },
  // The personal-shopper section: shown sharp in the panel and blurred behind it.
  personalShopper: {
    src: "/demo/personal-shopper.jpg",
    alt: "Relaxed model seated in a tracksuit",
  },
} satisfies Record<string, SiteImage>;

/*
  ⚠ TEMPORARY demo photos for the sample products and collections, matched by
  slug (the product's or category's web-address name in the database).
  Products/collections not listed here show the styled placeholder.
  Delete these lists once real photos are uploaded through the admin dashboard.
*/
export const demoProductImages: Record<string, string> = {
  "retro-high-85": "/demo/product-retro-high-85.jpg",
  "heavyweight-street-tee": "/demo/product-heavyweight-street-tee.jpg",
  "classic-white-court": "/demo/product-classic-white-court.jpg",
  "slim-fit-corporate-shirt": "/demo/product-slim-fit-corporate-shirt.jpg",
  "washed-black-jeans": "/demo/product-washed-black-jeans.jpg",
};

export const demoCategoryImages: Record<string, string> = {
  shoes: "/demo/collection-shoes.jpg",
  clothing: "/demo/collection-clothing.jpg",
  accessories: "/demo/collection-accessories.jpg",
};

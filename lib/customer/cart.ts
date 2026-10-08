import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
  A SIGNED-IN CUSTOMER'S SAVED CART — the same cart on the website and in the
  RSN app. Like the cart kept on a device it is for display only: checkout
  always takes prices from the catalogue. We only check that it is a sensible
  cart (shape and size), and keep just the fields the cart uses.
*/
export type SavedCartLine = {
  productId: string;
  slug: string;
  name: string;
  categoryName: string;
  image?: string;
  priceKobo: number;
  size: string | null;
  quantity: number;
  availability: string | null;
  availabilityLabel: string | null;
};

export type SavedCart = { lines: SavedCartLine[]; updatedAt: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;

function cleanLine(value: unknown): SavedCartLine | null {
  if (!value || typeof value !== "object") return null;
  const l = value as Record<string, unknown>;
  if (
    typeof l.productId !== "string" || !UUID.test(l.productId) ||
    !text(l.slug, 200) || !text(l.name, 200) || !text(l.categoryName, 100) ||
    !(l.image === undefined || l.image === null || text(l.image, 1000)) ||
    !Number.isInteger(l.priceKobo) || (l.priceKobo as number) < 0 ||
    !(l.size === null || text(l.size, 20)) ||
    !Number.isInteger(l.quantity) || (l.quantity as number) < 1 || (l.quantity as number) > 10 ||
    !(l.availability === null || l.availability === undefined || text(l.availability, 40)) ||
    !(l.availabilityLabel === null || l.availabilityLabel === undefined || text(l.availabilityLabel, 100))
  ) {
    return null;
  }
  return {
    productId: l.productId,
    slug: l.slug as string,
    name: l.name as string,
    categoryName: l.categoryName as string,
    ...(typeof l.image === "string" ? { image: l.image } : {}),
    priceKobo: l.priceKobo as number,
    size: l.size as string | null,
    quantity: l.quantity as number,
    availability: (l.availability as string | null | undefined) ?? null,
    availabilityLabel: (l.availabilityLabel as string | null | undefined) ?? null,
  };
}

// A cart sent by the website or the app, cleaned — or null if it isn't a cart.
export function cleanCart(body: unknown): SavedCartLine[] | null {
  const lines = (body as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines) || lines.length > 50) return null;
  const clean = lines.map(cleanLine);
  return clean.every((l): l is SavedCartLine => l !== null) ? clean : null;
}

export async function getSavedCart(customerId: string): Promise<SavedCart> {
  const { data, error } = await createAdminClient().rpc("get_customer_cart", { p_customer_id: customerId });
  if (error) {
    console.error("[cart] could not load saved cart:", error.code);
    throw new Error("Could not load your cart");
  }
  const lines = cleanCart(data) ?? [];
  return { lines, updatedAt: (data as { updated_at?: string | null })?.updated_at ?? null };
}

export async function saveCart(customerId: string, lines: SavedCartLine[]): Promise<string> {
  const { data, error } = await createAdminClient().rpc("save_customer_cart", { p_customer_id: customerId, p_lines: lines });
  if (error) {
    console.error("[cart] could not save cart:", error.code);
    throw new Error("Could not save your cart");
  }
  return data as string;
}

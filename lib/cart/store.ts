import { useMemo, useSyncExternalStore } from "react";
import type { ProductAvailability } from "@/lib/catalog/availability";
import type { Product } from "@/lib/catalog/types";

/*
  THE SHOPPING CART — kept in the visitor's browser only.

  - Nothing here talks to Supabase: adding to the cart never creates an order.
  - The cart is saved in the browser (localStorage), so it survives page
    changes and refreshes, and no sign-in is needed.
  - One cart line = one product in one size. Adding the same product in the
    same size again increases the quantity instead of adding a second line.
  - Prices stored here are ONLY for displaying the cart. The cart page
    refreshes them from the live catalogue, and checkout will always
    recalculate everything on the server.
*/

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  categoryName: string;
  image?: string;
  priceKobo: number;
  size: string | null; // null = product has no sizes
  quantity: number;
  availability: ProductAvailability | null;
  availabilityLabel: string | null;
};

export const MAX_QUANTITY = 10; // per cart line
const STORAGE_KEY = "rsn-cart-v1";
const ADDED_EVENT = "rsn:cart-added";

type CartState = { lines: CartLine[] };
const EMPTY: CartState = { lines: [] };

// The identity of a cart line: same product + same size = same line.
export function lineKey(line: Pick<CartLine, "productId" | "size">) {
  return `${line.productId}::${line.size ?? ""}`;
}

// ---------------------------------------------------------------------
// Reading and saving (ignores anything malformed in storage)
// ---------------------------------------------------------------------
function isValidLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const l = value as Record<string, unknown>;
  return (
    typeof l.productId === "string" &&
    typeof l.slug === "string" &&
    typeof l.name === "string" &&
    typeof l.categoryName === "string" &&
    (l.image === undefined || typeof l.image === "string") &&
    Number.isInteger(l.priceKobo) && (l.priceKobo as number) >= 0 &&
    (l.size === null || typeof l.size === "string") &&
    Number.isInteger(l.quantity) && (l.quantity as number) >= 1 && (l.quantity as number) <= MAX_QUANTITY
  );
}

function load(): CartState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    const lines = Array.isArray((parsed as CartState)?.lines) ? (parsed as CartState).lines.filter(isValidLine) : [];
    return { lines };
  } catch {
    return EMPTY;
  }
}

let state: CartState | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): CartState {
  if (state === null) state = typeof window === "undefined" ? EMPTY : load();
  return state;
}

// On the server (and during the first render in the browser) the cart is empty.
function getServerSnapshot(): CartState {
  return EMPTY;
}

function setState(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (e.g. private mode): the cart still works for this page visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep several open tabs in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      state = load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------
// The details of a product that the cart keeps (shared by every "Add to cart").
export function cartItemFromProduct(product: Product, size: string | null): Omit<CartLine, "quantity"> {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    categoryName: product.category.name,
    image: product.image,
    priceKobo: product.priceKobo,
    size,
    availability: product.availability,
    availabilityLabel: product.availabilityLabel,
  };
}

// Returns the line's new quantity and whether the 10-per-line limit cut the addition short.
export function addToCart(item: Omit<CartLine, "quantity">, quantity = 1) {
  const current = getSnapshot();
  const key = lineKey(item);
  const existing = current.lines.find((line) => lineKey(line) === key);
  const wanted = (existing?.quantity ?? 0) + Math.max(1, Math.round(quantity));
  const newQuantity = Math.min(MAX_QUANTITY, wanted);
  const lines = existing
    ? current.lines.map((line) =>
        lineKey(line) === key
          ? { ...line, ...item, quantity: newQuantity }
          : line,
      )
    : [...current.lines, { ...item, quantity: newQuantity }];
  setState({ lines });
  const capped = wanted > MAX_QUANTITY;
  window.dispatchEvent(
    new CustomEvent(ADDED_EVENT, { detail: { name: item.name, size: item.size, quantity: newQuantity, capped } }),
  );
  return { quantity: newQuantity, capped };
}

export function setLineQuantity(key: string, quantity: number) {
  const q = Math.min(MAX_QUANTITY, Math.max(1, Math.round(quantity)));
  setState({ lines: getSnapshot().lines.map((line) => (lineKey(line) === key ? { ...line, quantity: q } : line)) });
}

export function removeLine(key: string) {
  setState({ lines: getSnapshot().lines.filter((line) => lineKey(line) !== key) });
}

// Replace line details (e.g. refreshed price/name/photo) without changing quantities.
export function refreshLines(update: (line: CartLine) => CartLine) {
  const current = getSnapshot();
  const lines = current.lines.map(update);
  if (JSON.stringify(lines) !== JSON.stringify(current.lines)) setState({ lines });
}

// Listen for "item added" (used by the small confirmation message).
export type ItemAddedDetail = { name: string; size: string | null; quantity: number; capped: boolean };
export function onItemAdded(handler: (detail: ItemAddedDetail) => void) {
  const listener = (event: Event) => handler((event as CustomEvent).detail);
  window.addEventListener(ADDED_EVENT, listener);
  return () => window.removeEventListener(ADDED_EVENT, listener);
}

// ---------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------
export function useCart() {
  const { lines } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(
    () => ({
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalKobo: lines.reduce((sum, line) => sum + line.priceKobo * line.quantity, 0),
    }),
    [lines],
  );
}

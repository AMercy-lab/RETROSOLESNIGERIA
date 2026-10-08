import { useMemo, useSyncExternalStore } from "react";
import type { ProductAvailability } from "@/lib/catalog/availability";
import type { Product } from "@/lib/catalog/types";

/*
  THE SHOPPING CART — kept in the visitor's browser, and for signed-in
  customers also saved to their account (so the RSN app shows the same cart).

  - Adding to the cart never creates an order.
  - The cart is saved in the browser (localStorage), so it survives page
    changes and refreshes, and no sign-in is needed.
  - Signed in, every change is also sent to /api/account/cart, and the saved
    cart is fetched again when a page opens or the tab comes back into view
    (see syncCart below). The first time on a device, the guest cart and the
    account's cart are combined.
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

function setState(next: CartState, fromAccount = false) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (e.g. private mode): the cart still works for this page visit.
  }
  listeners.forEach((listener) => listener());
  if (!fromAccount) changedLocally();
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

// Empty the cart (after an order has been placed).
export function clearCart() {
  setState(EMPTY);
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
// Syncing with the signed-in customer's account
// ---------------------------------------------------------------------
const SYNC_KEY = "rsn-cart-sync-v1";
// account: the email this browser's cart was last synced with (null = guest cart)
// dirty: changed here but not yet saved to the account (e.g. while offline)
type SyncInfo = { account: string | null; dirty: boolean };

function loadSync(): SyncInfo {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SYNC_KEY) ?? "null") as SyncInfo | null;
    return { account: typeof parsed?.account === "string" ? parsed.account : null, dirty: parsed?.dirty === true };
  } catch {
    return { account: null, dirty: false };
  }
}

function saveSync(info: SyncInfo) {
  try {
    window.localStorage.setItem(SYNC_KEY, JSON.stringify(info));
  } catch {
    // Storage blocked: syncing simply starts again next time.
  }
}

// Supabase keeps the login in a cookie named sb-<project>-auth-token.
const looksSignedIn = () => /(?:^|;\s*)sb-[^=]+-auth-token/.test(document.cookie);

const sameLines = (a: CartLine[], b: CartLine[]) => JSON.stringify(a) === JSON.stringify(b);

// Combine two carts: every line from both; the bigger quantity where both have it.
function combine(account: CartLine[], device: CartLine[]): CartLine[] {
  const lines = account.map((line) => {
    const mine = device.find((l) => lineKey(l) === lineKey(line));
    return mine ? { ...line, quantity: Math.max(line.quantity, mine.quantity) } : line;
  });
  const extra = device.filter((l) => !account.some((line) => lineKey(line) === lineKey(l)));
  return [...lines, ...extra].slice(0, 50);
}

// Signed out: forget the account's cart on this browser (it stays saved on the account).
function signedOut() {
  if (loadSync().account) {
    saveSync({ account: null, dirty: false });
    setState(EMPTY, true);
  }
}

async function pushToAccount() {
  try {
    const res = await fetch("/api/account/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: getSnapshot().lines }),
    });
    if (res.ok) saveSync({ ...loadSync(), dirty: false });
    else if (res.status === 401) signedOut();
  } catch {
    // Offline: still marked "dirty", so it is sent at the next sync.
  }
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function changedLocally() {
  const info = loadSync();
  if (!info.account) return; // a guest cart stays in this browser
  saveSync({ ...info, dirty: true });
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushToAccount, 400);
}

let syncing: Promise<void> | null = null;

// Bring this browser's cart and the account's saved cart in line.
export function syncCart() {
  if (typeof window === "undefined") return Promise.resolve();
  syncing ??= (async () => {
    try {
      if (!looksSignedIn()) return signedOut();
      const res = await fetch("/api/account/cart", { cache: "no-store" });
      if (res.status === 401) return signedOut();
      if (!res.ok) return;
      const saved = (await res.json()) as { email: string; lines: unknown[] };
      const accountLines = (Array.isArray(saved.lines) ? saved.lines : []).filter(isValidLine);
      const device = getSnapshot().lines;
      const info = loadSync();

      if (info.account !== saved.email) {
        // First sync for this account here: combine the guest cart with the saved one.
        const lines = combine(accountLines, info.account ? [] : device);
        setState({ lines }, true);
        saveSync({ account: saved.email, dirty: true });
        await pushToAccount();
      } else if (info.dirty) {
        await pushToAccount(); // changes made here while offline win
      } else if (!sameLines(device, accountLines)) {
        setState({ lines: accountLines }, true); // changed on another device
      }
    } catch {
      // Offline: try again at the next sync.
    } finally {
      syncing = null;
    }
  })();
  return syncing;
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

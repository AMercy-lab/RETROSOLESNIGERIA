"use client";

import Link from "next/link";
import { BagIcon } from "@/components/icons";
import { useCart } from "@/lib/cart/store";

// The cart button in the header: a red pill with the bag and the number of
// items (plus the word "Cart" on wider screens), so it is easy to spot on phones.
export default function CartLink() {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={count === 0 ? "Cart, empty" : `Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="ml-1 flex items-center gap-1.5 rounded-full bg-brand-red px-3 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark sm:px-4"
      data-testid="cart-link"
    >
      <BagIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      <span className="tabular-nums">{count > 99 ? "99+" : count}</span>
    </Link>
  );
}

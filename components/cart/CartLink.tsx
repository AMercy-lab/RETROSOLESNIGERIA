"use client";

import Link from "next/link";
import { BagIcon } from "@/components/icons";
import { useCart } from "@/lib/cart/store";

// The cart icon in the header, with the number of items in the cart.
export default function CartLink() {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={count === 0 ? "Cart, empty" : `Cart, ${count} item${count === 1 ? "" : "s"}`}
      className="relative p-2 transition-colors hover:text-brand-red"
    >
      <BagIcon />
      {count > 0 && (
        <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onItemAdded } from "@/lib/cart/store";

// A short "Added to cart" message after adding a product, with a link to the cart.
export default function CartToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const stop = onItemAdded(({ name, size, capped }) => {
      const what = size ? `${name} (size ${size})` : name;
      setMessage(capped ? `${what}: maximum of 10 in your cart` : `${what} added to your cart`);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 4000);
    });
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      {message && (
        <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-full bg-brand-charcoal py-2 pl-5 pr-2 text-sm text-white shadow-2xl">
          <span className="truncate">{message}</span>
          <Link
            href="/cart"
            className="shrink-0 rounded-full bg-brand-red px-4 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors hover:bg-brand-red-dark"
          >
            View cart
          </Link>
        </div>
      )}
    </div>
  );
}

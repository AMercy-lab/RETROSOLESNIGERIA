"use client";

import { useRef, useState } from "react";
import type { Product } from "@/lib/catalog/types";
import { formatNaira } from "@/lib/format";
import SizePicker from "@/components/cart/SizePicker";
import { addToCart, cartItemFromProduct } from "@/lib/cart/store";

/*
  "Add to cart" for a product card.
  - Product without sizes: adds straight away.
  - Product with sizes: opens a panel (bottom sheet on phones) where a size
    must be chosen before it can be added.
  Only the browser cart changes — no order is created.
*/
export default function AddToCartButton({ product }: { product: Product }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [size, setSize] = useState<string | null>(null);
  const hasSizes = product.sizes.length > 0;

  function add(selectedSize: string | null) {
    addToCart(cartItemFromProduct(product, selectedSize));
  }

  function open() {
    setSize(null);
    dialog.current?.showModal();
  }

  function confirm() {
    if (!size) return;
    add(size);
    dialog.current?.close();
  }

  const button =
    "w-full rounded-full border border-brand-ink/15 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest transition-colors hover:border-brand-red hover:bg-brand-red hover:text-white";

  if (!hasSizes) {
    return (
      <button type="button" onClick={() => add(null)} className={button}>
        Add to cart
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={open} className={button}>
        Choose size
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`size-title-${product.id}`}
        onClick={(event) => {
          // Clicking the dark background closes the panel.
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-brand-ink backdrop:bg-black/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
      >
        <div className="flex flex-col gap-5 p-6 pb-8 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-brand-muted">{product.category.name}</p>
              <h2 id={`size-title-${product.id}`} className="font-display text-3xl leading-none tracking-wide">
                {product.name}
              </h2>
              <p className="mt-1 font-semibold text-brand-red">{formatNaira(product.priceKobo)}</p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="-mr-2 -mt-1 rounded-full p-2 text-2xl leading-none text-brand-muted hover:text-brand-ink"
            >
              ×
            </button>
          </div>

          <SizePicker name={`size-${product.id}`} sizes={product.sizes} value={size} onChange={setSize} />

          {product.availabilityLabel && (
            <p className="text-sm">
              <span className="text-brand-muted">Availability:</span>{" "}
              <span className="font-semibold">{product.availabilityLabel}</span>
            </p>
          )}
          <p className="text-xs text-brand-muted">
            RSN confirms availability and your delivery fee before you pay.
          </p>

          <button
            type="button"
            onClick={confirm}
            disabled={!size}
            className="rounded-full bg-brand-red px-6 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-ink/20"
          >
            {size ? `Add size ${size} to cart` : "Select a size"}
          </button>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import SizePicker from "@/components/cart/SizePicker";
import type { Product } from "@/lib/catalog/types";
import { MAX_QUANTITY, addToCart, cartItemFromProduct } from "@/lib/cart/store";

/*
  Size (if the product has sizes), quantity and "Add to cart" on the product page.
  Uses the same cart as everywhere else: the same product in the same size
  adds to the existing cart line (up to 10). Availability is shown but never
  blocks adding — RSN confirms with the supplier at checkout.
*/
export default function ProductPurchasePanel({ product }: { product: Product }) {
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const needsSize = product.sizes.length > 0 && size === null;

  function add() {
    if (needsSize) return;
    addToCart(cartItemFromProduct(product, product.sizes.length > 0 ? size : null), quantity);
    setQuantity(1);
  }

  return (
    <div className="flex flex-col gap-6">
      {product.sizes.length > 0 && (
        <SizePicker name={`pdp-size-${product.id}`} sizes={product.sizes} value={size} onChange={setSize} />
      )}

      <div className="flex flex-col gap-3">
        <span id="pdp-quantity-label" className="text-xs font-semibold uppercase tracking-[0.2em]">
          Quantity
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-full border border-brand-ink/15" role="group" aria-labelledby="pdp-quantity-label">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:opacity-30"
            >
              −
            </button>
            <span className="w-10 text-center font-semibold" aria-live="polite" data-testid="pdp-quantity">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              disabled={quantity >= MAX_QUANTITY}
              aria-label="Increase quantity"
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg disabled:opacity-30"
            >
              +
            </button>
          </div>
          {quantity >= MAX_QUANTITY && <span className="text-xs text-brand-muted">Maximum {MAX_QUANTITY} per item</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={add}
        disabled={needsSize}
        className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-not-allowed disabled:bg-brand-ink/20"
      >
        {needsSize ? "Select a size" : product.sizes.length > 0 ? `Add size ${size} to cart` : "Add to cart"}
      </button>
    </div>
  );
}

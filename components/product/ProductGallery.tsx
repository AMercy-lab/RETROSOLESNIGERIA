"use client";

import { useState } from "react";
import BrandImage from "@/components/BrandImage";

/*
  Product photos.
  - No photo: the styled RSN placeholder.
  - One photo: just that photo (no empty gallery).
  - Several photos: a main photo with small thumbnails to switch between them.
*/
export default function ProductGallery({
  images,
  alt,
  placeholderLabel,
}: {
  images: string[];
  alt: string;
  placeholderLabel: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-brand-mist">
        <BrandImage
          src={current}
          alt={images.length > 1 ? `${alt} — photo ${active + 1} of ${images.length}` : alt}
          label={placeholderLabel}
          preload
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>

      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1" role="group" aria-label="Product photos">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1} of ${images.length}`}
              aria-current={i === active}
              className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl bg-brand-mist ring-offset-2 transition ${
                i === active ? "ring-2 ring-brand-ink" : "opacity-70 hover:opacity-100"
              }`}
            >
              <BrandImage src={src} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

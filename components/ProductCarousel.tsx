"use client";

import { Children, useRef, type ReactNode } from "react";
import { ArrowIcon, ArrowLeftIcon } from "@/components/icons";

/*
  A sideways-scrolling row (e.g. "Trending now").
  Swipe on phones, or use the arrow buttons on larger screens.
  Pass the cards as children; each one becomes a slide.
  "heading" shows on the left, level with the arrow buttons.
*/
export default function ProductCarousel({
  label,
  heading,
  children,
}: {
  label: string;
  heading?: ReactNode;
  children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);

  function scroll(direction: 1 | -1) {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const button =
    "flex h-11 w-11 items-center justify-center rounded-full border border-brand-ink/15 bg-white transition-colors hover:border-brand-red hover:bg-brand-red hover:text-white";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div>{heading}</div>
        <div className="hidden shrink-0 gap-2 md:flex">
          <button type="button" onClick={() => scroll(-1)} aria-label={`Scroll ${label} back`} className={button}>
            <ArrowLeftIcon />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={`Scroll ${label} forward`} className={button}>
            <ArrowIcon />
          </button>
        </div>
      </div>
      <div
        ref={track}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:gap-6"
      >
        {Children.map(children, (child) => (
          <div className="w-[70%] shrink-0 snap-start sm:w-[42%] md:w-[30%] lg:w-[23%]">{child}</div>
        ))}
      </div>
    </div>
  );
}

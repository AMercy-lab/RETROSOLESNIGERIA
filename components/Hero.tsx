import Image from "next/image";
import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import WelcomeGreeting from "@/components/WelcomeGreeting";
import { images } from "@/lib/images";

/*
  The homepage hero: a rounded panel floating over a blurred backdrop,
  with a giant RETROSOLES wordmark standing behind the model.
  The photos come from lib/images.ts (hero and heroBackdrop).
  The panel colour is --color-brand-hero in app/globals.css.
*/
export default function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Backdrop src={images.heroBackdrop.src} />

      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-8">
        <div className="relative flex flex-col overflow-hidden rounded-3xl bg-brand-hero text-brand-ink shadow-2xl shadow-black/40 md:block md:h-[min(80vh,720px)] md:min-h-[620px]">
          {/* Top left: greeting and what we sell */}
          <div className="relative z-20 flex flex-col gap-4 p-6 sm:p-10 md:absolute md:left-0 md:top-0">
            {/* Later: firstName will come from the signed-in customer's Google account */}
            <div className="text-brand-ink/70">
              <WelcomeGreeting firstName={null} />
            </div>
            <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.35em]">
              Sneakers · Shoes
              <br />
              Streetwear · Corporate
            </p>
            <span className="h-px w-10 bg-brand-ink" />
          </div>

          {/* The wordmark, with the model standing in front of it */}
          <div className="relative h-[440px] sm:h-[540px] md:absolute md:inset-0 md:h-auto">
            <p
              aria-hidden="true"
              className="absolute inset-x-0 top-[42%] -translate-y-1/2 md:top-[33%] select-none whitespace-nowrap text-center font-display text-[22vw] leading-none md:text-[18vw] xl:text-[14.5rem]"
            >
              RETROSOLES<span className="text-brand-red">.</span>
            </p>
            <div className="absolute bottom-0 left-1/2 z-10 aspect-[456/844] h-[92%] -translate-x-1/2">
              <Image
                src={images.hero.src}
                alt={images.hero.alt}
                fill
                preload
                sizes="(min-width: 768px) 360px, 60vw"
                className="object-contain object-bottom"
              />
            </div>
          </div>

          {/* Bottom left: headline and buttons */}
          <div className="relative z-20 flex flex-col gap-5 p-6 sm:p-10 md:absolute md:bottom-0 md:left-0 md:max-w-md">
            <h1 className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">
              Personal shopping <span className="text-brand-red">made easy.</span>
            </h1>
            <p className="max-w-xs text-sm text-brand-ink/70">
              Sneakers, sharp shoes, streetwear and corporate fits — picked for you, delivered to you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#trending"
                className="rounded-full bg-brand-red px-7 py-3.5 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
              >
                Shop new arrivals
              </Link>
              <Link
                href="#personal-shopper"
                className="rounded-full border border-brand-ink/30 px-7 py-3.5 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white"
              >
                Tell us what you need
              </Link>
            </div>
          </div>

          {/* Bottom right label (larger screens) */}
          <div className="absolute bottom-10 right-10 z-20 hidden flex-col items-end gap-3 text-right md:flex">
            <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.35em]">
              New season
              <br />
              The RSN edit
            </p>
            <span className="h-px w-10 bg-brand-ink" />
          </div>
        </div>
      </div>
    </section>
  );
}

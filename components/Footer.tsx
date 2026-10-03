import Link from "next/link";
import Logo from "@/components/Logo";
import type { CategoryGroup } from "@/lib/catalog/types";
import { groupHref } from "@/lib/categories";
import { site } from "@/lib/site";

// Help pages are not built yet, so these show as plain text for now.
const helpItems = ["Contact us", "Delivery information", "Returns & exchanges", "Size guide"];

export default function Footer({ categoryGroups }: { categoryGroups: CategoryGroup[] }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-charcoal text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-4">
        <div className="flex flex-col gap-4 md:col-span-2">
          <Logo />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">{site.motto}</p>
          <p className="max-w-sm text-sm text-white/60">
            Men&apos;s fashion, sneakers for him and her, and the pieces you can&apos;t find anywhere
            else — sourced for you by {site.shortName}.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-2xl tracking-wider text-white/50">Shop</h3>
          {categoryGroups.map((group) => (
            <Link key={group.slug} href={groupHref(group.slug)} className="text-sm transition-colors hover:text-brand-red">
              {group.name}
            </Link>
          ))}
          <Link href="/search" className="text-sm transition-colors hover:text-brand-red">
            All products
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-display text-2xl tracking-wider text-white/50">Help</h3>
          {helpItems.map((item) => (
            <span key={item} className="text-sm text-white/60">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-xs uppercase tracking-widest text-white/40 sm:px-6">
          &copy; {year} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

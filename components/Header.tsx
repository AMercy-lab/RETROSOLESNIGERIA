import Link from "next/link";
import Logo from "@/components/Logo";
import { BagIcon, ChevronDownIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import type { CategoryGroup } from "@/lib/catalog/types";
import { categoryHref, groupHref } from "@/lib/categories";
import { site } from "@/lib/site";

/*
  The top of every page:
    1. a thin red announcement bar
    2. the charcoal main bar: menu on the left, logo in the centre,
       search / account / cart icons on the right
  The menu is built from the database categories, so new categories appear automatically.
*/
export default function Header({ categoryGroups }: { categoryGroups: CategoryGroup[] }) {
  return (
    <header className="sticky top-0 z-50">
      {/* 1. Announcement bar */}
      <div className="bg-brand-red px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white sm:text-xs">
        {site.announcement}
      </div>

      {/* 2. Main bar */}
      <div className="bg-brand-charcoal text-white">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:h-20 sm:px-6">
          <div className="flex h-full items-center">
            {/* Mobile menu: tap to open/close, no JavaScript needed. Hidden on large screens. */}
            <details className="group lg:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-widest [&::-webkit-details-marker]:hidden">
                <MenuIcon className="h-4 w-4" />
                <span className="group-open:hidden">Menu</span>
                <span className="hidden group-open:inline">Close</span>
              </summary>
              <nav
                aria-label="Mobile"
                className="absolute inset-x-0 top-full max-h-[75vh] overflow-y-auto bg-white px-4 pb-8 pt-2 text-brand-ink shadow-2xl sm:px-6"
              >
                {categoryGroups.map((group) => (
                  <div key={group.slug} className="border-b border-brand-ink/10 py-5">
                    <Link href={groupHref(group.slug)} className="font-display text-3xl tracking-wide">
                      {group.name}
                    </Link>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.categories.map((category) => (
                        <Link
                          key={category.slug}
                          href={categoryHref(category.slug)}
                          className="rounded-full bg-brand-mist px-3.5 py-1.5 text-sm transition-colors hover:bg-brand-red hover:text-white"
                        >
                          {category.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </details>

            {/* Desktop menu — each collection opens a dropdown on hover or keyboard focus */}
            <nav aria-label="Main" className="hidden h-full items-center gap-8 lg:flex">
              {categoryGroups.map((group) => (
                <div key={group.slug} className="group relative flex h-full items-center">
                  <Link
                    href={groupHref(group.slug)}
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:text-brand-red"
                  >
                    {group.name}
                    <ChevronDownIcon />
                  </Link>
                  <div className="invisible absolute left-0 top-full w-60 overflow-hidden rounded-b-xl border-t-2 border-brand-red bg-white py-3 text-brand-ink opacity-0 shadow-2xl transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                    {group.categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={categoryHref(category.slug)}
                        className="block px-5 py-2.5 text-sm transition-colors hover:bg-brand-mist hover:text-brand-red"
                      >
                        {category.name}
                      </Link>
                    ))}
                    <Link
                      href={groupHref(group.slug)}
                      className="mt-1 block border-t border-brand-ink/10 px-5 pt-3 text-xs font-semibold uppercase tracking-widest text-brand-red"
                    >
                      Shop all {group.name}
                    </Link>
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <Logo />

          {/* Icons. Account and cart are placeholders until sign-in and the cart are built. */}
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <Link href="/search" aria-label="Search" className="p-2 transition-colors hover:text-brand-red">
              <SearchIcon />
            </Link>
            <span title="Sign in — coming soon" aria-label="Account (coming soon)" className="hidden cursor-not-allowed p-2 opacity-40 sm:block">
              <UserIcon />
            </span>
            <span title="Cart — coming soon" aria-label="Cart (coming soon)" className="relative cursor-not-allowed p-2 opacity-40">
              <BagIcon />
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                0
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

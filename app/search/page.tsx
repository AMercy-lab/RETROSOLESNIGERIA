import type { Metadata } from "next";
import Link from "next/link";
import PersonalShopperCTA from "@/components/PersonalShopperCTA";
import ProductCard from "@/components/ProductCard";
import SearchForm from "@/components/SearchForm";
import { categoryHref, findCategory, findGroup, groupHref } from "@/lib/categories";
import { searchProducts } from "@/lib/search";

export const metadata: Metadata = {
  title: "Shop",
};

// Web addresses can repeat a value (?q=a&q=b). We only want the first one.
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/*
  The search / shop page. It reads the web address, for example:
    /search?q=black+sneakers     -> search by keywords
    /search?category=sneakers    -> one category
    /search?group=shoes          -> one whole collection
*/
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = first(params.q)?.trim() ?? "";
  const categorySlug = first(params.category);
  const groupSlug = first(params.group);

  const category = categorySlug ? findCategory(categorySlug) : undefined;
  const group = category?.group ?? (groupSlug ? findGroup(groupSlug) : undefined);

  const results = searchProducts({
    query,
    category: categorySlug,
    group: category ? undefined : groupSlug,
  });

  const heading = query
    ? `Results for “${query}”`
    : category?.name ?? group?.name ?? "All products";

  return (
    <>
      <section className="bg-brand-cream">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 md:py-16">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-red">
            {group ? group.name : "Shop"}
          </p>
          <h1 className="text-4xl font-black uppercase tracking-tight sm:text-5xl">{heading}</h1>
          <div className="max-w-2xl">
            <SearchForm defaultValue={query} />
          </div>

          {/* Category chips for the current collection */}
          {group && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={groupHref(group.slug)}
                className={`border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                  !category ? "border-brand-black bg-brand-black text-white" : "border-brand-black/15 hover:border-brand-red hover:text-brand-red"
                }`}
              >
                All {group.name}
              </Link>
              {group.categories.map((c) => (
                <Link
                  key={c.slug}
                  href={categoryHref(c.slug)}
                  className={`border px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                    c.slug === categorySlug ? "border-brand-black bg-brand-black text-white" : "border-brand-black/15 hover:border-brand-red hover:text-brand-red"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {results.length > 0 ? (
          <>
            <p className="mb-8 text-sm text-brand-muted">
              {results.length} {results.length === 1 ? "item" : "items"}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-lg text-brand-muted">
            Nothing in store matches that yet — but RSN can still help. See below.
          </p>
        )}
      </section>

      <PersonalShopperCTA query={results.length === 0 ? query || category?.name : undefined} />
    </>
  );
}

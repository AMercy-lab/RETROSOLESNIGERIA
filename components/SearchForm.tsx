import { SearchIcon } from "@/components/icons";

/*
  A search box. Submitting it opens the /search page with the typed words,
  e.g. /search?q=black+sneakers. Plain HTML form, so no JavaScript needed.
*/
export default function SearchForm({
  defaultValue = "",
  placeholder = "Search sneakers, shirts, caps…",
  variant = "light",
}: {
  defaultValue?: string;
  placeholder?: string;
  variant?: "light" | "dark";
}) {
  const box =
    variant === "dark"
      ? "border-white/20 bg-white/5 text-white placeholder:text-white/50 focus-within:border-white"
      : "border-brand-black/15 bg-white text-brand-black placeholder:text-brand-muted focus-within:border-brand-black";

  return (
    <form action="/search" role="search" className={`flex w-full items-center border ${box} transition-colors`}>
      <label className="flex flex-1 items-center">
        <span className="sr-only">Search products</span>
        <SearchIcon className="ml-4 h-5 w-5 shrink-0 opacity-60" />
        <input
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full min-w-0 bg-transparent px-3 py-4 text-base outline-none"
        />
      </label>
      <button
        type="submit"
        className="m-1.5 shrink-0 bg-brand-red px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark"
      >
        Search
      </button>
    </form>
  );
}

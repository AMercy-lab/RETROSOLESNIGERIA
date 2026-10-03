"use client";

/*
  Size chips (one choice). Used by the product card's size panel and the
  product page, so both look and behave the same.
*/
export default function SizePicker({
  name,
  sizes,
  value,
  onChange,
}: {
  name: string; // unique per page, groups the choices
  sizes: string[];
  value: string | null;
  onChange: (size: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-[0.2em]">Select a size</legend>
      <div className="flex flex-wrap gap-2">
        {sizes.map((s) => (
          <label key={s} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={s}
              checked={value === s}
              onChange={() => onChange(s)}
              className="peer sr-only"
            />
            <span className="flex h-11 min-w-11 items-center justify-center rounded-full border border-brand-ink/15 px-4 text-sm font-semibold transition-colors peer-checked:border-brand-ink peer-checked:bg-brand-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-red">
              {s}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

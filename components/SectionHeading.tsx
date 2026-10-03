/*
  A section title in the RSN style: a small spaced-out label, then a tall
  headline that ends in a red full stop — e.g. "NEW ARRIVALS."
  Pass the title without the full stop; it is added automatically.
*/
export default function SectionHeading({
  eyebrow,
  title,
  as: Tag = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-red">{eyebrow}</p>
      )}
      <Tag className="font-display text-5xl leading-[0.9] tracking-wide sm:text-6xl">
        {title}
        <span className="text-brand-red">.</span>
      </Tag>
    </div>
  );
}

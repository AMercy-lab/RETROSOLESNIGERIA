import Image from "next/image";

/*
  Shows a photo if one is given, otherwise a styled placeholder.
  So when you add real images later (put them in /public and set the
  "image" field on a product or category), they appear automatically.

  The parent element decides the size: it must be "relative" and have
  a height or aspect ratio, e.g. className="relative aspect-[4/5]".
*/
export default function BrandImage({
  src,
  alt,
  label,
  tone = "light",
  sizes = "(min-width: 768px) 25vw, 50vw",
  priority = false,
}: {
  src?: string;
  alt: string;
  label?: string;
  tone?: "light" | "dark";
  sizes?: string;
  priority?: boolean;
}) {
  if (src) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />;
  }

  const colours =
    tone === "dark"
      ? "bg-brand-ink text-white/25"
      : "bg-brand-cream text-brand-black/20";

  return (
    <div role="img" aria-label={alt} className={`absolute inset-0 flex items-center justify-center ${colours}`}>
      {label && (
        <span className="select-none px-4 text-center text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          {label}
        </span>
      )}
    </div>
  );
}

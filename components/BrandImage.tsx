import Image from "next/image";

/*
  Shows a photo if one is given, otherwise a styled placeholder.
  So when you add real images later (put them in /public and set the
  "image" field on a product or category, or edit lib/images.ts),
  they appear automatically.

  The parent element decides the size: it must be "relative" and have
  a height or aspect ratio, e.g. className="relative aspect-[4/5]".

  position: which part of the photo stays visible when cropped, e.g. "center top".
  fit: "cover" fills the box (may crop), "contain" shows the whole photo.
*/
export default function BrandImage({
  src,
  alt,
  label,
  tone = "light",
  sizes = "(min-width: 768px) 25vw, 50vw",
  preload = false,
  position,
  fit = "cover",
}: {
  src?: string;
  alt: string;
  label?: string;
  tone?: "light" | "dark";
  sizes?: string;
  preload?: boolean;
  position?: string;
  fit?: "cover" | "contain";
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        className={fit === "contain" ? "object-contain" : "object-cover"}
        style={position ? { objectPosition: position } : undefined}
      />
    );
  }

  const colours =
    tone === "dark"
      ? "bg-brand-charcoal text-white/20"
      : "bg-brand-mist text-brand-ink/15";

  return (
    <div role="img" aria-label={alt} className={`absolute inset-0 flex items-center justify-center ${colours}`}>
      {label && (
        <span className="select-none px-4 text-center font-display text-4xl leading-none tracking-wide sm:text-6xl">
          {label}
        </span>
      )}
    </div>
  );
}

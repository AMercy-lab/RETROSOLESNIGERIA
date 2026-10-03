import Image from "next/image";

/*
  The blurred, tinted photo behind a section — it gives the page its
  atmosphere while floating panels sit on top.

  Put it as the first child of a section with "relative isolate overflow-hidden".
  Any photo works: it is enlarged and blurred heavily, then washed with
  charcoal and a soft red glow so it always stays on-brand.

  tint: "charcoal" (subtle) or "red" (stronger red glow)
*/
export default function Backdrop({
  src,
  tint = "charcoal",
}: {
  src?: string;
  tint?: "charcoal" | "red";
}) {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden bg-brand-charcoal">
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes="40vw"
          className="scale-125 object-cover opacity-80 blur-3xl saturate-50"
        />
      )}
      <div className="absolute inset-0 bg-brand-charcoal/55" />
      <div
        className={`absolute inset-0 ${
          tint === "red"
            ? "bg-[radial-gradient(ellipse_at_80%_20%,color-mix(in_oklab,var(--color-brand-red)_45%,transparent),transparent_60%)]"
            : "bg-[radial-gradient(ellipse_at_85%_0%,color-mix(in_oklab,var(--color-brand-red)_22%,transparent),transparent_55%)]"
        }`}
      />
    </div>
  );
}

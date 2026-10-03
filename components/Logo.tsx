import Link from "next/link";
import { site } from "@/lib/site";

/*
  The brand logo, used in the header and footer.

  For now it is text in the headline font: "RETROSOLES" takes the colour of
  the area around it (white on charcoal) and "NIGERIA" is always red.

  When the real logo is ready:
    1. Put the logo file in the /public folder, e.g. /public/logo.png
    2. Replace everything inside <Link> ... </Link> below with:
         <Image src="/logo.png" alt={site.name} width={180} height={40} preload />
       and add  import Image from "next/image";  at the top.
  Because the header and footer both use this one component,
  that single change updates the logo everywhere.
*/
export default function Logo() {
  return (
    <Link
      href="/"
      aria-label={`${site.name} home`}
      className="font-display text-2xl leading-none tracking-wider sm:text-4xl"
    >
      RETROSOLES<span className="text-brand-red">NIGERIA</span>
    </Link>
  );
}

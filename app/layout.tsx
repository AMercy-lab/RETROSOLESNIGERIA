import type { Metadata } from "next";
import { Bebas_Neue, Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartToast from "@/components/cart/CartToast";
import { getCategoryGroups } from "@/lib/catalog/queries";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tall condensed font for large headings (class "font-display")
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

// The title shown in the browser tab and in Google search results.
// Future pages can set their own title, e.g. "Shop", which will show
// as "Shop | RETROSOLESNIGERIA" thanks to the template below.
export const metadata: Metadata = {
  title: {
    default: "RETROSOLESNIGERIA | Personal shopping made easy",
    template: "%s | RETROSOLESNIGERIA",
  },
  description:
    "RETROSOLESNIGERIA (RSN) — personal shopping made easy. Men's fashion, sneakers for him and her, shoes, clothing and accessories in Nigeria.",
};

/*
  Catalogue pages are pre-built for speed and refreshed from the database at
  most every 60 seconds, so product, price and availability changes show up within a minute.
  (While developing with `npm run dev`, every page load reads fresh data.)
*/
export const revalidate = 60;

// The layout wraps every page: header on top, page content in the
// middle, footer at the bottom. The menus are built from the database categories.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const categoryGroups = await getCategoryGroups();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bebasNeue.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Header categoryGroups={categoryGroups} />
        <main className="flex-1">{children}</main>
        <Footer categoryGroups={categoryGroups} />
        <CartToast />
      </body>
    </html>
  );
}

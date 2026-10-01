import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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

// The layout wraps every page: header on top, page content in the
// middle, footer at the bottom.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

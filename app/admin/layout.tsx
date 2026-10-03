import type { Metadata } from "next";

// The admin area is private: keep it out of search engines.
export const metadata: Metadata = {
  title: { default: "RSN Admin", template: "%s | RSN Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

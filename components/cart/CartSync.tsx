"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { syncCart } from "@/lib/cart/store";

/*
  Keeps a signed-in customer's cart the same as in the RSN app: syncs when a
  page opens (including right after signing in) and whenever the tab comes
  back into view. Does nothing for guests.
*/
export default function CartSync() {
  const pathname = usePathname();

  useEffect(() => {
    syncCart();
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && syncCart();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}

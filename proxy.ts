import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

/*
  Runs before the admin, sign-in, account and order pages only (see `matcher`).
  It keeps the admin's or customer's sign-in session fresh: if the short-lived login token
  has expired, Supabase renews it here and the new cookie is sent back.
  Shop pages are not affected, so they stay fast and cacheable.
  (Next.js 16 calls this file "proxy"; older versions called it "middleware".)
*/
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Responses that set login cookies must never be cached and shared.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Checks (and if needed renews) the session. Do not remove.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/auth/:path*", "/account/:path*", "/orders/:path*", "/checkout"],
};

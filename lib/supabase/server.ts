import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/supabase/env";

/*
  Supabase connection for code that runs ON THE SERVER: server components,
  server actions and route handlers (app/api/...).

  It reads the visitor's login cookie, so it acts as that visitor and the
  database security rules (RLS) still apply. Create a new one per request —
  never share it between visitors.
*/
export async function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components can't set cookies. That's fine: the session is
          // refreshed by proxy.ts (for the admin area) before the page renders.
        }
      },
    },
  });
}

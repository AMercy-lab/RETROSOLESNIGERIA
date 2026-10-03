import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/*
  Read-only connection for PUBLIC data (the catalogue), used on the server.

  Unlike lib/supabase/server.ts it does not read the visitor's login cookie,
  so it always acts as a signed-out visitor. That means:
    - the security rules (RLS) only let it see active categories and products
    - pages that use it can still be pre-built and cached for speed
*/
export function createPublicClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

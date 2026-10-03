import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

/*
  Supabase connection for code that runs IN THE BROWSER ("use client" components),
  e.g. a customer uploading a payment-proof file.

  It acts as whoever is signed in, so the database security rules (RLS)
  decide what it may read or change.
*/
export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createBrowserClient(url, publishableKey);
}

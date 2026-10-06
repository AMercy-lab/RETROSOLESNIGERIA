import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

/*
  ⚠ TRUSTED SERVER-ONLY connection using the SECRET key.

  It BYPASSES the database security rules (RLS), so use it only in server code
  that has already checked who is asking and validated the input — for example:
    - creating an order with prices read from the database
    - recording a Paystack payment after verifying it with Paystack
    - saving a personal-shopping request

  The "server-only" import above makes the build fail if this file is ever
  imported into browser code, so the secret key can't leak to visitors.
*/
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim().replace(/^["']+|["']+$/g, "");

  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing from .env.local " +
        "(Supabase dashboard → Project Settings → API Keys → Secret keys).",
    );
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

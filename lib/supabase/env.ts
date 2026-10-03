/*
  Reads the PUBLIC Supabase settings from environment variables (.env.local).

  These two values are safe to send to the browser: the publishable key only
  allows what the database security rules (RLS) allow.
  The SECRET key is read separately, in lib/supabase/admin.ts, server-side only.

  Note: Next.js only puts NEXT_PUBLIC_ variables into browser code when they are
  written out in full like below, so don't "simplify" these into a loop.
*/
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(Supabase dashboard → Project Settings → API Keys), then restart `npm run dev`.",
    );
  }

  return { url, publishableKey };
}

// True when the public Supabase settings are present.
export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

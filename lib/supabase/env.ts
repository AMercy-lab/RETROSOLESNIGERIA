/*
  Reads the PUBLIC Supabase settings from environment variables (.env.local).

  These two values are safe to send to the browser: the publishable key only
  allows what the database security rules (RLS) allow.
  The SECRET key is read separately, in lib/supabase/admin.ts, server-side only.

  Note: Next.js only puts NEXT_PUBLIC_ variables into browser code when they are
  written out in full like below, so don't "simplify" these into a loop.
*/

// Removes stray spaces, line breaks and quote marks that easily sneak in when
// a value is pasted into a hosting dashboard (e.g. Vercel).
function clean(value: string | undefined) {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

export function getSupabaseEnv() {
  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
  const publishableKey = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(Supabase dashboard → Project Settings → API Keys), then restart `npm run dev`." +
        ` (URL set: ${Boolean(url)}, publishable key set: ${Boolean(publishableKey)})`,
    );
  }

  // The project URL is public (it is sent to every visitor's browser), so it is
  // safe to show it in the error to make a wrong value easy to spot.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL. It should look like ` +
        `https://abcdefgh.supabase.co but it is: ${JSON.stringify(url.slice(0, 120))}`,
    );
  }

  return { url, publishableKey };
}

// True when the public Supabase settings are present.
export function isSupabaseConfigured() {
  return Boolean(clean(process.env.NEXT_PUBLIC_SUPABASE_URL) && clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));
}

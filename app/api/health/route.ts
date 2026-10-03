import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/*
  Connection check: open http://localhost:3000/api/health in the browser.
  It asks the database how many categories exist, using the PUBLIC key,
  which also proves the security rules let visitors browse the catalogue.
  The future mobile app can use the same /api/... address style.
*/
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, supabase: "not configured — fill in .env.local and restart npm run dev" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  // A normal (not "head") request, so a missing table comes back as a real error.
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact" })
    .limit(1);

  if (error || count === null) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "connected, but the database query failed — have the migrations been run?",
        // Error details only while developing, never on the live site.
        detail: process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, supabase: "connected", categories: count });
}

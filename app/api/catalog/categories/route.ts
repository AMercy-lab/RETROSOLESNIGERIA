import { NextResponse } from "next/server";
import { getCategoryGroups } from "@/lib/catalog/queries";

/*
  GET /api/catalog/categories
  The active categories, grouped by collection — the same data the website menus use.
  Public (no sign-in needed). Intended for the future RSN mobile app.
*/
export async function GET() {
  try {
    return NextResponse.json({ categories: await getCategoryGroups() });
  } catch {
    return NextResponse.json({ error: "Could not load categories" }, { status: 500 });
  }
}

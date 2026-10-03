import { NextResponse, type NextRequest } from "next/server";
import { searchProducts } from "@/lib/catalog/queries";

/*
  GET /api/catalog/products
  Active products, with optional filters — the same search the website uses:
    ?q=black+sneakers      words to search for
    ?category=sneakers     one subcategory
    ?group=shoes           one whole collection
  Public (no sign-in needed). Intended for the future RSN mobile app.
*/
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  try {
    const products = await searchProducts({
      query: params.get("q")?.trim().slice(0, 200) ?? "",
      category: params.get("category") ?? undefined,
      group: params.get("group") ?? undefined,
    });
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json({ error: "Could not load products" }, { status: 500 });
  }
}

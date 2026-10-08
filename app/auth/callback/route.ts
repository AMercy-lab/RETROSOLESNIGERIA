import { NextResponse, type NextRequest } from "next/server";
import { claimOrdersByEmail } from "@/lib/customer/session";
import { createClient } from "@/lib/supabase/server";

/*
  The emailed sign-in link brings the admin (or a customer) here with a
  one-time `code`. We swap it for a login session (saved in a secure cookie)
  and continue to the admin area or the customer's account.
  Only links requested in THIS browser work.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // Only allow continuing to a page inside the admin area or the account.
  const nextParam = searchParams.get("next") ?? "/admin";
  const customer = nextParam === "/account";
  const next = customer ? "/account" : nextParam.startsWith("/admin") && !nextParam.startsWith("//") ? nextParam : "/admin";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (customer && data.user) await claimOrdersByEmail(data.user.id);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(customer ? `${origin}/account?error=link` : `${origin}/admin/login?error=link`);
}

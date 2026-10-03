import "server-only";
import { createClient } from "@/lib/supabase/server";

/*
  Who is signed in, and are they an RSN admin?
  - The user is verified with Supabase's Auth server (getUser), not just read
    from the cookie.
  - Admin rights come from the database (is_admin(), backed by the `admins`
    table), which only the project owner can change in the SQL Editor.
*/
export async function getAdminSession(): Promise<
  | { status: "signed-out" }
  | { status: "not-admin"; email: string | null }
  | { status: "admin"; userId: string; email: string | null }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "signed-out" };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) return { status: "not-admin", email: data.user.email ?? null };

  return { status: "admin", userId: data.user.id, email: data.user.email ?? null };
}

// Email addresses allowed to CREATE an account via the admin sign-in page
// (comma-separated in RSN_ADMIN_EMAIL). This never grants admin rights by itself.
export function allowedAdminEmails(): string[] {
  return (process.env.RSN_ADMIN_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

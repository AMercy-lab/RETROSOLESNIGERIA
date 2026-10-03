"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowedAdminEmails } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SENT: SignInState = {
  status: "sent",
  message: "If this email has admin access, a sign-in link is on its way. Open it in this same browser.",
};

/*
  Sends a one-time sign-in link by email (no password).
  - Only an email listed in RSN_ADMIN_EMAIL may get a NEW account created here.
  - Everyone else only gets a link if they already have an account.
  - The reply is the same either way, so the page never reveals who has access.
*/
export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: allowedAdminEmails().includes(email),
      emailRedirectTo: `${origin}/auth/callback?next=/admin`,
    },
  });

  if (error) {
    if (error.status === 429) {
      return { status: "error", message: "Too many sign-in emails were requested. Please wait a few minutes and try again." };
    }
    // e.g. "signups not allowed" for unknown emails: answer exactly as if it worked.
    console.error("[admin sign-in] link not sent:", error.code ?? error.status);
  }
  return SENT;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

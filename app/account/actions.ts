"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { claimOrdersByEmail } from "@/lib/customer/session";
import { createClient } from "@/lib/supabase/server";

export type CodeState = { step: "email" | "code"; email?: string; message?: string; error?: string };

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/*
  Customer sign-in, no password:
  1. sendCode: we email a one-time code (a new account is created the first
     time). The email's link also works, if opened in this same browser.
  2. verifyCode: the customer types the code; the login is saved in a secure
     cookie, and guest orders placed with this email join their account.
*/
// The sign-in form's one action: which step runs depends on where the form is.
export async function signInStep(prev: CodeState, formData: FormData): Promise<CodeState> {
  return prev.step === "code" ? verifyCode(prev, formData) : sendCode(prev, formData);
}

async function sendCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) {
    return { step: "email", error: "Please enter a valid email address." };
  }
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${origin}/auth/callback?next=/account` },
  });
  if (error) {
    if (error.status === 429) {
      return { step: "email", email, error: "Too many codes were requested. Please wait a few minutes and try again." };
    }
    console.error("[customer sign-in] code not sent:", error.code ?? error.status);
    return { step: "email", email, error: "We couldn't send your code just now. Please try again in a moment." };
  }
  return { step: "code", email, message: `We've emailed a code to ${email}. It can take a minute to arrive.` };
}

async function verifyCode(prev: CodeState, formData: FormData): Promise<CodeState> {
  if (formData.get("intent") === "resend") return sendCode(prev, formData);
  if (formData.get("intent") === "change") return { step: "email", email: prev.email };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(code)) {
    return { step: "code", email, error: "Please enter the code from the email." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || !data.user) {
    return { step: "code", email, error: "That code is wrong or has expired. Please check it, or send a new one." };
  }
  await claimOrdersByEmail(data.user.id);
  redirect("/account");
}

export async function signOutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/account");
}

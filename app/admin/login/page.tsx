import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInForm from "@/components/admin/SignInForm";
import SectionHeading from "@/components/SectionHeading";
import { getAdminSession } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Sign in" };

// Admin sign-in: email -> one-time sign-in link. No passwords.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (session.status === "admin") redirect("/admin");

  const { error } = await searchParams;
  const initialError =
    error === "link" ? "That sign-in link has expired or was opened in a different browser. Please request a new one." : undefined;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6 md:py-24">
      <SectionHeading as="h1" eyebrow="RSN admin" title="Sign in" />
      <p className="text-brand-muted">
        Enter your admin email and we&apos;ll send you a one-time sign-in link. Open it in this same browser.
      </p>
      <SignInForm initialError={initialError} />
    </section>
  );
}

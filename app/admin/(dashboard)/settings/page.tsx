import type { Metadata } from "next";
import BankDetailsForm from "@/components/admin/BankDetailsForm";
import SectionHeading from "@/components/SectionHeading";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

// Store settings: RSN's bank details for customers paying by transfer.
export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("store_settings")
    .select("bank_name, bank_account_name, bank_account_number")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <SectionHeading as="h1" eyebrow="RSN admin" title="Settings" />
      <section className="flex flex-col gap-4 rounded-3xl bg-brand-mist p-5 sm:p-7">
        <h2 className="font-display text-3xl tracking-wide">Bank details</h2>
        <p className="text-sm text-brand-muted">
          Shown to customers paying by bank transfer, once you&apos;ve confirmed their order. Double-check them — customers
          will send money to this account.
        </p>
        <BankDetailsForm current={data ?? { bank_name: "", bank_account_name: "", bank_account_number: "" }} />
      </section>
    </div>
  );
}

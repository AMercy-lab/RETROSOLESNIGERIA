"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { status: "idle" | "ok" | "error"; message?: string };

// Saves RSN's bank details. The database only allows this for admins.
export async function saveBankDetails(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const session = await getAdminSession();
  if (session.status !== "admin") return { status: "error", message: "Only RSN admins can do this. Please sign in again." };

  const bankName = String(formData.get("bank_name") ?? "").trim();
  const accountName = String(formData.get("bank_account_name") ?? "").trim();
  const accountNumber = String(formData.get("bank_account_number") ?? "").replace(/\s/g, "");

  if (bankName.length < 2 || bankName.length > 80) return { status: "error", message: "Please enter the bank name." };
  if (accountName.length < 2 || accountName.length > 120) return { status: "error", message: "Please enter the account name." };
  if (!/^\d{10}$/.test(accountNumber)) return { status: "error", message: "A Nigerian account number has exactly 10 digits." };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("store_settings")
    .update({ bank_name: bankName, bank_account_name: accountName, bank_account_number: accountNumber }, { count: "exact" })
    .eq("id", 1);
  if (error || count !== 1) {
    console.error("[settings] save failed:", error?.code ?? "no row updated");
    return { status: "error", message: "The bank details could not be saved. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { status: "ok", message: "Bank details saved. Customers paying by transfer will see them straight away." };
}

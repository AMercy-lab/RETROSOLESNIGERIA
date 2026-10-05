import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

/*
  RSN's bank details, shown to customers when they pay by bank transfer.
  They live in the database (store_settings) and are changed by the admin on
  /admin/settings — never written into the code.
*/
export type BankDetails = { bankName: string; accountName: string; accountNumber: string };

export async function getBankDetails(): Promise<BankDetails | null> {
  const { data, error } = await createPublicClient()
    .from("store_settings")
    .select("bank_name, bank_account_name, bank_account_number")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const d = { bankName: data.bank_name.trim(), accountName: data.bank_account_name.trim(), accountNumber: data.bank_account_number.trim() };
  return d.bankName && d.accountName && d.accountNumber ? d : null;
}

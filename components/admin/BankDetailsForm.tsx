"use client";

import { useActionState } from "react";
import { saveBankDetails, type SettingsState } from "@/app/admin/(dashboard)/settings/actions";

const input =
  "w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-brand-ink";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]";

export default function BankDetailsForm({
  current,
}: {
  current: { bank_name: string; bank_account_name: string; bank_account_number: string };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveBankDetails, { status: "idle" });

  return (
    <form action={action} className="flex flex-col gap-4" data-testid="bank-form">
      <div>
        <label htmlFor="bank_name" className={label}>Bank name</label>
        <input id="bank_name" name="bank_name" required maxLength={80} defaultValue={current.bank_name} className={input} />
      </div>
      <div>
        <label htmlFor="bank_account_name" className={label}>Account name</label>
        <input id="bank_account_name" name="bank_account_name" required maxLength={120} defaultValue={current.bank_account_name} className={input} />
      </div>
      <div>
        <label htmlFor="bank_account_number" className={label}>Account number</label>
        <input
          id="bank_account_number"
          name="bank_account_number"
          required
          inputMode="numeric"
          pattern="[0-9 ]{10,13}"
          maxLength={13}
          defaultValue={current.bank_account_number}
          className={input}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save bank details"}
      </button>
      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-2xl px-4 py-3 text-sm ${state.status === "error" ? "bg-brand-red/10 text-brand-red-dark" : "bg-brand-mist"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

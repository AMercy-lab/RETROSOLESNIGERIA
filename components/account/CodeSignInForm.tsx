"use client";

import { useActionState } from "react";
import { signInStep, type CodeState } from "@/app/account/actions";

const INPUT =
  "w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-brand-ink";
const BUTTON =
  "rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-wait disabled:opacity-60";
const LINK_BUTTON =
  "text-xs font-semibold uppercase tracking-widest text-brand-muted underline underline-offset-4 transition-colors hover:text-brand-red disabled:opacity-60";

// Customer sign-in: email -> one-time code -> signed in. No passwords.
export default function CodeSignInForm() {
  const [state, action, pending] = useActionState<CodeState, FormData>(signInStep, { step: "email" });

  return (
    <form action={action} className="flex flex-col gap-4" data-testid="code-sign-in">
      {state.step === "email" ? (
        <>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]">
              Email
            </label>
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={state.email} className={INPUT} />
          </div>
          <button type="submit" disabled={pending} className={BUTTON}>
            {pending ? "Sending…" : "Email me a code"}
          </button>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email ?? ""} />
          {state.message && (
            <p role="status" className="rounded-2xl bg-brand-mist px-4 py-3 text-sm">
              {state.message}
            </p>
          )}
          <div>
            <label htmlFor="code" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]">
              Code from the email
            </label>
            <input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              autoFocus
              className={`${INPUT} tracking-[0.4em]`}
            />
          </div>
          <button type="submit" name="intent" value="verify" disabled={pending} className={BUTTON}>
            {pending ? "Checking…" : "Sign in"}
          </button>
          <div className="flex flex-wrap gap-6">
            <button type="submit" name="intent" value="resend" formNoValidate disabled={pending} className={LINK_BUTTON}>
              Send a new code
            </button>
            <button type="submit" name="intent" value="change" formNoValidate disabled={pending} className={LINK_BUTTON}>
              Use a different email
            </button>
          </div>
        </>
      )}
      {state.error && (
        <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
          {state.error}
        </p>
      )}
    </form>
  );
}

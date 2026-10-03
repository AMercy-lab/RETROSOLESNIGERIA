"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "@/app/admin/actions";

// The admin sign-in form: email -> one-time sign-in link.
export default function SignInForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(sendSignInLink, {
    status: initialError ? "error" : "idle",
    message: initialError,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.15em]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-2xl border border-brand-ink/15 bg-white px-4 py-3.5 text-base outline-none transition-colors focus:border-brand-ink"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-brand-red px-8 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.status === "sent" && (
        <p role="status" className="rounded-2xl bg-brand-mist px-4 py-3 text-sm">
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
          {state.message}
        </p>
      )}
    </form>
  );
}

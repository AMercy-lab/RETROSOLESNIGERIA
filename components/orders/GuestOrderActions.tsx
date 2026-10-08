"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/*
  The customer's buttons on their order page. They call the same
  /api/orders/<id>/... addresses the future mobile app will use, sending the
  private link secret in the request body (or, signed in, the login cookie),
  then refresh the page.
*/
function useGuestAction(orderId: string, token: string | null) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: "cancel" | "decision", body: Record<string, string>, question: string) {
    if (busy || !window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(token ? { token } : {}), ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "Something went wrong. Please try again.");
      else router.refresh();
    } catch {
      setError("We couldn't reach RSN. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ErrorNote({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="rounded-2xl bg-brand-red/10 px-4 py-3 text-sm text-brand-red-dark">
      {error}
    </p>
  ) : null;
}

// "Some items aren't available": continue without them, or cancel.
export function DecisionButtons({ orderId, token }: { orderId: string; token: string | null }) {
  const { busy, error, run } = useGuestAction(orderId, token);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run("decision", { decision: "continue" }, "Continue without the unavailable items? RSN will then confirm your new total.")
          }
          className="rounded-full bg-brand-red px-7 py-4 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-brand-red-dark disabled:opacity-60"
        >
          Continue without them
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run("decision", { decision: "cancel" }, "Cancel your whole order? Nothing has been paid.")}
          className="rounded-full border border-brand-ink/20 px-7 py-4 text-xs font-semibold uppercase tracking-widest transition-colors hover:border-brand-ink hover:bg-brand-ink hover:text-white disabled:opacity-60"
        >
          Cancel order
        </button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}

// Cancel any time before paying.
export function CancelOrderButton({ orderId, token }: { orderId: string; token: string | null }) {
  const { busy, error, run } = useGuestAction(orderId, token);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => run("cancel", {}, "Cancel this order? Nothing has been paid.")}
        className="self-start text-xs font-semibold uppercase tracking-widest text-brand-muted underline underline-offset-4 transition-colors hover:text-brand-red disabled:opacity-60"
      >
        {busy ? "Cancelling…" : "Cancel this order"}
      </button>
      <ErrorNote error={error} />
    </div>
  );
}

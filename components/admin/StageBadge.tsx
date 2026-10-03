import { STAGE_LABELS, type Stage } from "@/lib/admin/orders";

const STYLES: Record<Stage, string> = {
  needs_confirmation: "bg-brand-red text-white",
  confirmation_overdue: "bg-brand-red-dark text-white",
  payment_window_expired: "bg-brand-red/15 text-brand-red-dark",
  payment_to_verify: "bg-brand-red text-white",
  waiting_customer_decision: "bg-brand-steel text-brand-ink",
  awaiting_payment: "bg-brand-steel text-brand-ink",
  processing: "bg-brand-charcoal text-white",
  shipped: "bg-brand-charcoal text-white",
  delivered: "bg-brand-mist text-brand-ink",
  cancelled: "bg-brand-mist text-brand-muted",
  unavailable: "bg-brand-mist text-brand-muted",
};

export default function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest ${STYLES[stage]}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

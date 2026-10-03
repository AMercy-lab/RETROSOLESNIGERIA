import { BadgeIcon, LockIcon, ReturnIcon, TruckIcon } from "@/components/icons";

// PLACEHOLDER wording — edit to match what your business really offers.
const points = [
  { Icon: TruckIcon, title: "Delivery across Nigeria", text: "Straight to your door." },
  { Icon: ReturnIcon, title: "Easy exchanges", text: "Wrong size? We'll sort it." },
  { Icon: BadgeIcon, title: "Quality checked", text: "Every piece inspected." },
  { Icon: LockIcon, title: "Secure payment", text: "Pay with confidence." },
];

/* A row of short reassurances: delivery, exchanges, quality and payment. */
export default function TrustBar() {
  return (
    <section aria-label="Why shop with RSN" className="border-y border-brand-ink/10 bg-brand-mist">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        {points.map(({ Icon, title, text }) => (
          <div key={title} className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-brand-red">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em]">{title}</p>
              <p className="text-sm text-brand-muted">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

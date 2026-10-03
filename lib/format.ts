// Turns an amount in kobo into Naira for display, e.g. 8500000 -> "₦85,000"
export function formatNaira(kobo: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

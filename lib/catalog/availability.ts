/*
  PRODUCT AVAILABILITY — one status for the whole product (not per size),
  chosen by the admin. This list is the single source of truth for:
    - the future admin dropdown (value + label)
    - the future product page ("Availability: Confirm to purchase")
    - the API used by the future mobile app

  The values must match the "product_availability" type in the database
  (migration 20261004090000). Adding an option means a new migration too.
*/
export const AVAILABILITY_OPTIONS = [
  {
    value: "available",
    label: "Available",
    meaning: "RSN currently knows this product is available from the supplier.",
  },
  {
    value: "confirm_to_purchase",
    label: "Confirm to purchase",
    meaning: "RSN will confirm with the supplier before the purchase is treated as confirmed.",
  },
  {
    value: "subject_to_availability",
    label: "Subject to availability",
    meaning: "Availability can change and depends on the supplier.",
  },
] as const;

export type ProductAvailability = (typeof AVAILABILITY_OPTIONS)[number]["value"];

export function isProductAvailability(value: unknown): value is ProductAvailability {
  return AVAILABILITY_OPTIONS.some((option) => option.value === value);
}

// e.g. "confirm_to_purchase" -> "Confirm to purchase"
export function availabilityLabel(value: ProductAvailability) {
  return AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

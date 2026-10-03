/*
  Orders placed on THIS device (browser only).
  A guest's private order link secret is kept here so the customer can come
  back to their order later (the order page is built in the next stage).
  It never leaves the device except to open that customer's own order.
*/
export type SavedOrder = {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  confirmationDueAt: string;
  placedAt: string;
};

const KEY = "rsn-orders-v1";

export function loadSavedOrders(): SavedOrder[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (o): o is SavedOrder =>
            !!o && typeof o.orderId === "string" && typeof o.orderNumber === "string" && typeof o.accessToken === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function saveOrder(order: SavedOrder) {
  try {
    const others = loadSavedOrders().filter((o) => o.orderId !== order.orderId);
    window.localStorage.setItem(KEY, JSON.stringify([order, ...others].slice(0, 20)));
  } catch {
    // Storage blocked: the confirmation screen still shows the order number.
  }
}

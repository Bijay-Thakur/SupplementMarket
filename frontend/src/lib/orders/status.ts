export const ORDER_STATUS_LABELS: Record<string, string> = {
  placed: "Order sent",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export function paymentStatusLabel(status: string | undefined): string {
  return status === "paid" ? "Paid" : "Payment pending";
}

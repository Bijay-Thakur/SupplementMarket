"use client";

import { Download, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import type { OrderPublic } from "@/lib/api/types";

type ReceiptOrder = Pick<
  OrderPublic,
  | "order_number"
  | "customer_name"
  | "fulfillment_type"
  | "payment_status"
  | "currency"
  | "subtotal_cents"
  | "delivery_fee_cents"
  | "total_cents"
  | "items"
  | "created_at"
  | "paid_at"
>;

function receiptText(order: ReceiptOrder) {
  const currency = order.currency || "USD";
  const lines = order.items.map(
    (item) =>
      `${item.product_name} x ${item.quantity}  ${formatCents(item.line_total_cents, currency)}`,
  );
  return [
    "Bronxville Natural Market",
    "PAYMENT RECEIPT",
    "",
    `Order: ${order.order_number}`,
    `Customer: ${order.customer_name}`,
    `Ordered: ${order.created_at ? new Date(order.created_at).toLocaleString() : "—"}`,
    `Paid: ${order.paid_at ? new Date(order.paid_at).toLocaleString() : "Paid"}`,
    `Fulfillment: ${order.fulfillment_type}`,
    "",
    ...lines,
    "",
    `Subtotal: ${formatCents(order.subtotal_cents, currency)}`,
    order.delivery_fee_cents != null
      ? `Delivery: ${formatCents(order.delivery_fee_cents, currency)}`
      : null,
    `Total paid: ${formatCents(order.total_cents, currency)}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\r\n");
}

export function ReceiptActions({ order }: { order: ReceiptOrder }) {
  if (order.payment_status !== "paid") return null;

  function download() {
    const blob = new Blob([receiptText(order)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `receipt-${order.order_number}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="receipt-actions mt-5 flex flex-wrap gap-3">
      <button type="button" className={buttonVariants({ variant: "outline" })} onClick={download}>
        <Download className="h-4 w-4" aria-hidden="true" />
        Download receipt
      </button>
      <button type="button" className={buttonVariants()} onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden="true" />
        Print or save PDF
      </button>
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  adminGetOrder,
  adminMarkOrderNotificationSeen,
  adminUpdateOrderStatus,
} from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import { ApiRequestError } from "@/lib/api/client";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders/status";
import { useEffect, useState } from "react";

const PICKUP_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];
const DELIVERY_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => adminGetOrder(Number(id)),
    enabled: Boolean(id),
  });
  const o = q.data;

  useEffect(() => {
    if (!o?.id || o.admin_seen_at) return;
    void adminMarkOrderNotificationSeen(o.id).catch(() => undefined);
  }, [o?.admin_seen_at, o?.id]);

  if (q.isError) {
    return <p className="text-sm text-[color:var(--danger)]">This order could not be loaded.</p>;
  }
  if (!o) return <p>Loading…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold">{o.order_number}</h1>
      {o.is_demo && <p className="mt-1 text-xs uppercase text-[color:var(--brand-magenta)]">Demo order</p>}
      <p className="mt-4 text-sm">
        {o.customer_name} · {o.customer_email} · <a className="underline" href={`tel:${o.customer_phone.replace(/[^+\d]/g, "")}`}>{o.customer_phone}</a>
      </p>
      <p className="text-sm">
        {o.fulfillment_type}
        {o.delivery_address_line1
          ? ` · ${o.delivery_address_line1}, ${o.delivery_city}, ${o.delivery_state} ${o.delivery_zip}`
          : ""}
      </p>
      <div className="mt-4 grid gap-4 rounded-[--radius] border border-[color:var(--border)] bg-surface p-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Order status
          <select
            className="fld mt-1"
            value={o.status}
            disabled={updating}
            onChange={async (event) => {
              setUpdating(true);
              setUpdateError(null);
              try {
                await adminUpdateOrderStatus(o.id, event.target.value);
                await q.refetch();
              } catch (error) {
                setUpdateError(
                  error instanceof ApiRequestError ? error.message : "The order status could not be updated.",
                );
              } finally {
                setUpdating(false);
              }
            }}
          >
            {(o.fulfillment_type === "delivery" ? DELIVERY_STATUSES : PICKUP_STATUSES).map((status) => (
              <option key={status} value={status}>{orderStatusLabel(status)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Payment status
          <select
            className="fld mt-1"
            value={o.payment_status ?? "unpaid"}
            disabled={updating}
            onChange={async (event) => {
              setUpdating(true);
              setUpdateError(null);
              try {
                await adminUpdateOrderStatus(o.id, undefined, event.target.value);
                await q.refetch();
              } catch (error) {
                setUpdateError(
                  error instanceof ApiRequestError ? error.message : "The payment status could not be updated.",
                );
              } finally {
                setUpdating(false);
              }
            }}
          >
            <option value="unpaid">{paymentStatusLabel("unpaid")}</option>
            <option value="paid">{paymentStatusLabel("paid")}</option>
          </select>
        </label>
      </div>
      {o.delivery_instructions && (
        <p className="mt-2 text-sm">
          <strong>Delivery instructions:</strong> {o.delivery_instructions}
        </p>
      )}
      {updating && <p className="mt-2 text-sm text-[color:var(--muted)]">Updating status…</p>}
      {updateError && <p className="mt-2 text-sm text-[color:var(--danger)]">{updateError}</p>}
      <ul className="mt-6 space-y-2 text-sm">
        {o.items.map((i) => (
          <li key={i.sku ?? i.product_name} className="flex justify-between">
            <span>
              {i.product_name} × {i.quantity}
            </span>
            <span>{formatCents(i.line_total_cents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between font-semibold">
        <span>Total (server-calculated)</span>
        <span>{formatCents(o.total_cents)}</span>
      </p>
    </div>
  );
}

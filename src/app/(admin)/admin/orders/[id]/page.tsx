"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { adminGetOrder, adminUpdateOrderStatus } from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";

const STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "completed",
  "cancelled",
];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => adminGetOrder(Number(id)),
    enabled: Boolean(id),
  });
  const o = q.data;
  if (!o) return <p>Loading…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-semibold">{o.order_number}</h1>
      {o.is_demo && <p className="mt-1 text-xs uppercase text-[color:var(--brand-magenta)]">Demo order</p>}
      <p className="mt-4 text-sm">
        {o.customer_name} · {o.customer_email} · {o.customer_phone}
      </p>
      <p className="text-sm">
        {o.fulfillment_type}
        {o.delivery_address_line1
          ? ` · ${o.delivery_address_line1}, ${o.delivery_city}, ${o.delivery_state} ${o.delivery_zip}`
          : ""}
      </p>
      <label className="mt-4 block text-sm">
        Status
        <select
          className="fld max-w-xs"
          value={o.status}
          onChange={(e) =>
            adminUpdateOrderStatus(o.id, e.target.value).then(() => q.refetch())
          }
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
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

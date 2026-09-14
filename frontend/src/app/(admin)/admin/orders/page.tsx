"use client";

import { useQuery } from "@tanstack/react-query";
import { adminOrders } from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import Link from "next/link";
import { useState } from "react";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders/status";

export default function AdminOrdersPage() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin-orders", q],
    queryFn: () => adminOrders({ q: q || undefined }),
    refetchInterval: 5_000,
  });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Orders</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Customer order requests awaiting store confirmation. No online payment is collected.
      </p>
      <input
        className="fld mt-4 max-w-sm"
        placeholder="Search order # or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {list.isLoading && <p className="mt-6 text-sm text-[color:var(--muted)]">Loading orders…</p>}
      {list.isError && (
        <p className="mt-6 text-sm text-[color:var(--danger)]">
          Orders could not be loaded. Refresh the page and try again.
        </p>
      )}
      <ul className="mt-6 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
        {(list.data?.items ?? []).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
              {o.order_number}
            </Link>
            <span className="text-sm">
              {o.customer_name} · {o.fulfillment_type} · {orderStatusLabel(o.status)} · {paymentStatusLabel(o.payment_status)} · {formatCents(o.total_cents)}
            </span>
          </li>
        ))}
        {list.data?.items.length === 0 && !list.isLoading && (
          <li className="px-4 py-8 text-sm text-[color:var(--muted)]">No orders yet.</li>
        )}
      </ul>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { adminOrders, adminUpdateOrderStatus } from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import Link from "next/link";
import { useState } from "react";

export default function AdminOrdersPage() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["admin-orders", q],
    queryFn: () => adminOrders({ q: q || undefined }),
  });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Orders</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">Demonstration order requests — not live payments.</p>
      <input
        className="fld mt-4 max-w-sm"
        placeholder="Search order # or name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="mt-6 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
        {(list.data?.items ?? []).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
              {o.order_number}
            </Link>
            <span className="text-sm">
              {o.customer_name} · {o.fulfillment_type} · {o.status} · {formatCents(o.total_cents)}
            </span>
          </li>
        ))}
        {list.data?.items.length === 0 && (
          <li className="px-4 py-8 text-sm text-[color:var(--muted)]">No orders yet.</li>
        )}
      </ul>
    </div>
  );
}

void adminUpdateOrderStatus;

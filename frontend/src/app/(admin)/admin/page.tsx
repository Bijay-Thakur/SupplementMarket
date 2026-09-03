"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { adminDashboard } from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";

export default function AdminDashboardPage() {
  const q = useQuery({ queryKey: ["admin-dash"], queryFn: adminDashboard });
  const d = q.data;
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Demonstration catalog. Official manufacturer products are labeled Demo
        until the store verifies shelf inventory and pricing.
        {d?.persistence_notice ? ` ${d.persistence_notice}` : ""}
      </p>
      {q.isError && <p className="mt-4 text-[color:var(--danger)]">Could not load stats. Please refresh.</p>}
      {d && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Active products" value={d.active_products} href="/admin/products" />
            <Stat label="On sale" value={d.on_sale} href="/admin/products?on_sale=1" />
            <Stat label="Out of stock" value={d.out_of_stock} />
            <Stat label="New" value={d.new_products} />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/admin/products/new" className={buttonVariants()}>
              Add product
            </Link>
            <Link href="/admin/import" className={buttonVariants({ variant: "outline" })}>
              Import CSV
            </Link>
            <Link href="/admin/orders" className={buttonVariants({ variant: "outline" })}>
              View orders
            </Link>
          </div>
          <h2 className="mt-10 font-display text-xl font-semibold">Recent demo orders</h2>
          <ul className="mt-3 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
            {d.recent_orders.length === 0 && (
              <li className="px-4 py-6 text-sm text-[color:var(--muted)]">No orders yet.</li>
            )}
            {d.recent_orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                  {o.order_number}
                </Link>
                <span>
                  {o.customer_name} · {formatCents(o.total_cents)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <>
      <p className="text-sm text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </>
  );
  const cls = "rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

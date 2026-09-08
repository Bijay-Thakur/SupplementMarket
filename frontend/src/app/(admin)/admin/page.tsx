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
        Catalog and operations overview.
      </p>
      {q.isError && <p className="mt-4 text-[color:var(--danger)]">Could not load stats. Please refresh.</p>}
      {d && (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total products" value={d.total_products ?? d.active_products} href="/admin/products" />
            <Stat label="Active products" value={d.active_products} href="/admin/products" />
            <Stat label="Draft products" value={d.draft_products} href="/admin/products" />
            <Stat label="Brands" value={d.brand_count} href="/admin/taxonomy" />
            <Stat label="Categories" value={d.category_count} href="/admin/taxonomy" />
            <Stat label="On sale" value={d.on_sale} href="/admin/products?on_sale=1" />
            <Stat label="Missing images" value={d.missing_images} href="/admin/products" />
            <Stat label="Recent imports" value={d.recent_import_count} href="/admin/products/imports" />
          </div>
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold">Shortcuts</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/admin/products/new" className={buttonVariants()}>
                Add Product
              </Link>
              <Link href="/admin/products/import" className={buttonVariants({ variant: "outline" })}>
                Upload CSV
              </Link>
              <Link href="/admin/products" className={buttonVariants({ variant: "outline" })}>
                Manage Products
              </Link>
              <Link href="/admin/taxonomy" className={buttonVariants({ variant: "outline" })}>
                Manage Brands
              </Link>
              <Link href="/admin/taxonomy" className={buttonVariants({ variant: "outline" })}>
                Manage Categories
              </Link>
              <Link href="/admin/promotions" className={buttonVariants({ variant: "outline" })}>
                Update Prices
              </Link>
            </div>
          </div>
          <h2 className="mt-10 font-display text-xl font-semibold">Recent orders</h2>
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

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | undefined;
  href?: string;
}) {
  const coming = value == null;
  const inner = (
    <>
      <p className="text-sm text-[color:var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{coming ? "—" : value}</p>
      {coming ? <p className="mt-2 text-xs text-[color:var(--muted)]">Coming next</p> : null}
    </>
  );
  const cls = "rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5";
  return href && !coming ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

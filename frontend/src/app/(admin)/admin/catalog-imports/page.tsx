"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { catalogImports } from "@/lib/api/catalog";
import { buttonVariants } from "@/components/ui/button";

export default function CatalogImportsPage() {
  const list = useQuery({ queryKey: ["catalog-imports"], queryFn: catalogImports, refetchInterval: 4000 });
  const rows = list.data ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Brand catalog imports</h1>
          <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">
            Official manufacturer sources for the catalog. Live re-collection
            needs the local Python collector.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/catalog-imports/sources" className={buttonVariants({ variant: "outline" })}>
            Sources
          </Link>
          <Link href="/admin/catalog-imports/new" className={buttonVariants()}>
            New collection
          </Link>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--brand-cream)] text-xs uppercase">
            <tr>
              <th className="p-3">Run</th>
              <th className="p-3">Status</th>
              <th className="p-3">Brands</th>
              <th className="p-3">Products</th>
              <th className="p-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--border)]">
                <td className="p-3">
                  <Link href={`/admin/catalog-imports/${r.id}`} className="font-medium hover:underline">
                    {r.id}
                  </Link>
                  {r.dry_run ? <span className="ml-2 text-xs text-[color:var(--muted)]">dry-run</span> : null}
                </td>
                <td className="p-3">{r.status}</td>
                <td className="p-3 text-xs">{r.brand_slugs.join(", ")}</td>
                <td className="p-3">{r.product_count}</td>
                <td className="p-3 text-xs">{r.started_at ? r.started_at.replace("T", " ").slice(0, 19) : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-[color:var(--muted)]" colSpan={5}>
                  No collections yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

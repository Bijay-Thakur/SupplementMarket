"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminArchiveProduct,
  adminDuplicateProduct,
  adminProducts,
  adminUpdateProduct,
} from "@/lib/api/catalog";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";

export default function AdminProductsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-products", q, page],
    queryFn: () => adminProducts({ q: q || undefined, page, page_size: 25, sort: "newest" }),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      adminUpdateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const rows = list.data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Demo rows are labeled. Archive instead of deleting. Prices are integer cents.
          </p>
        </div>
        <Link href="/admin/products/new" className={buttonVariants()}>
          Add product
        </Link>
      </div>
      <input
        className="mt-6 h-11 w-full max-w-md rounded-[--radius] border border-[color:var(--border)] px-3"
        placeholder="Search name, SKU, brand…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {list.isError && <p className="mt-4 text-[color:var(--danger)]">Failed to load products.</p>}
      <div className="mt-4 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--brand-cream)] text-xs uppercase">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Regular</th>
              <th className="p-3">Sale</th>
              <th className="p-3">Avail.</th>
              <th className="p-3">Flags</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[color:var(--border)]">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb src={r.thumbnail_url} alt="" className="h-12 w-12 rounded object-cover" />
                    <div>
                      <Link href={`/admin/products/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="text-xs text-[color:var(--muted)]">
                        {r.brand_name}
                        {r.is_demo ? " · Demo data" : ""}
                        {r.price_is_demo ? " · Demo pricing" : ""}
                        {r.image_use_status ? ` · Image: ${r.image_use_status}` : ""}
                        {r.is_archived ? " · Archived" : ""}
                      </p>
                      {r.source_url ? (
                        <a
                          className="text-[10px] text-[color:var(--brand-magenta)]"
                          href={r.source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Official source
                        </a>
                      ) : null}
                      {r.last_source_verification_at ? (
                        <p className="text-[10px] text-[color:var(--muted)]">
                          Verified {String(r.last_source_verification_at).slice(0, 10)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <InlineDollars
                    cents={r.regular_price_cents}
                    onSave={(cents) => patch.mutate({ id: r.id, body: { regular_price_cents: cents } })}
                  />
                </td>
                <td className="p-3">
                  <InlineDollars
                    cents={r.sale_price_cents}
                    allowEmpty
                    onSave={(cents) =>
                      patch.mutate({
                        id: r.id,
                        body: cents == null ? { remove_sale: true } : { sale_price_cents: cents },
                      })
                    }
                  />
                </td>
                <td className="p-3">
                  <select
                    className="h-9 rounded border border-[color:var(--border)]"
                    value={r.availability}
                    onChange={(e) =>
                      patch.mutate({ id: r.id, body: { availability: e.target.value } })
                    }
                  >
                    {["in_stock", "low_stock", "out_of_stock", "coming_soon"].map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <Toggle
                    label="Active"
                    on={r.is_active}
                    onChange={(v) => patch.mutate({ id: r.id, body: { is_active: v } })}
                  />
                  <Toggle
                    label="Featured"
                    on={r.is_featured}
                    onChange={(v) => patch.mutate({ id: r.id, body: { is_featured: v } })}
                  />
                  <Toggle
                    label="Best"
                    on={r.is_bestseller}
                    onChange={(v) => patch.mutate({ id: r.id, body: { is_bestseller: v } })}
                  />
                  <Toggle
                    label="New"
                    on={r.is_new}
                    onChange={(v) => patch.mutate({ id: r.id, body: { is_new: v } })}
                  />
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-1 text-xs">
                    <Link href={`/admin/products/${r.id}`} className="text-[color:var(--brand-magenta)]">
                      Edit
                    </Link>
                    <Link href={`/products/${r.slug}`} className="text-[color:var(--muted)]">
                      Preview
                    </Link>
                    <button
                      type="button"
                      onClick={() => adminDuplicateProduct(r.id).then(() => list.refetch())}
                    >
                      Duplicate
                    </button>
                    {!r.is_archived && (
                      <button
                        type="button"
                        className="text-[color:var(--danger)]"
                        onClick={() => {
                          if (confirm("Archive this product? It will leave the storefront.")) {
                            adminArchiveProduct(r.id).then(() => list.refetch());
                          }
                        }}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.data && list.data.pages > 1 && (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: list.data.pages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" className="h-9 min-w-9 rounded border px-2" onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      {patch.isError && (
        <p className="mt-3 text-sm text-[color:var(--danger)]">{String(patch.error.message)}</p>
      )}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mr-2 inline-flex items-center gap-1 text-xs">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function InlineDollars({
  cents,
  onSave,
  allowEmpty,
}: {
  cents: number | null;
  onSave: (cents: number | null) => void;
  allowEmpty?: boolean;
}) {
  const initial = useMemo(() => (cents == null ? "" : (cents / 100).toFixed(2)), [cents]);
  const [val, setVal] = useState(initial);
  return (
    <input
      className="h-9 w-24 rounded border border-[color:var(--border)] px-2"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (allowEmpty && val.trim() === "") {
          onSave(null);
          return;
        }
        const parsed = parseDollarsToCents(val);
        if (parsed == null || parsed < 0) {
          setVal(initial);
          return;
        }
        onSave(parsed);
      }}
      aria-label="Price in dollars"
    />
  );
}

void formatCents;
void AvailabilityBadge;

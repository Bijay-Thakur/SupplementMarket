"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  catalogApprove,
  catalogImportApproved,
  catalogRecalculate,
  catalogReject,
  getCatalogImport,
  patchStagedProduct,
  type StagedProduct,
} from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { Button, buttonVariants } from "@/components/ui/button";

export default function CatalogImportRunPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [drawer, setDrawer] = useState<StagedProduct | null>(null);
  const [activate, setActivate] = useState(false);

  const run = useQuery({
    queryKey: ["catalog-import", runId, q, status],
    queryFn: () => getCatalogImport(runId, { q: q || undefined, status: status || undefined }),
    refetchInterval: (query) => (query.state.data?.status === "collecting" ? 2500 : 8000),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["catalog-import", runId] });
  const approve = useMutation({
    mutationFn: (ids: number[]) => catalogApprove(runId, ids),
    onSuccess: invalidate,
  });
  const reject = useMutation({
    mutationFn: (ids: number[]) => catalogReject(runId, ids),
    onSuccess: invalidate,
  });
  const recalc = useMutation({
    mutationFn: (ids: number[]) => catalogRecalculate(runId, ids),
    onSuccess: invalidate,
  });
  const doImport = useMutation({
    mutationFn: () => catalogImportApproved(runId, { activate_after_import: activate }),
    onSuccess: invalidate,
  });

  const products = useMemo(() => run.data?.products ?? [], [run.data?.products]);
  const allIds = useMemo(() => products.map((p) => p.id), [products]);
  const selected = picked.length ? picked : allIds.filter((id) => products.find((p) => p.id === id)?.status === "needs_review");

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Import run {runId}</h1>
      {run.data && (
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Status: {run.data.status} · {run.data.product_count} products · sample pricing pending verification
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="h-11 min-w-48 rounded border px-3"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="h-11 rounded border px-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["needs_review", "approved", "rejected", "imported", "validation_failed", "source_blocked"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" onClick={() => approve.mutate(picked.length ? picked : selected)}>
          Bulk approve
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => reject.mutate(picked.length ? picked : selected)}>
          Bulk reject
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => recalc.mutate(picked.length ? picked : allIds)}>
          Recalculate demo prices
        </Button>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/v1/admin/catalog-imports/${runId}/export`}>
          CSV export
        </a>
        <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/v1/admin/catalog-imports/${runId}/errors`}>
          Error export
        </a>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} />
          Activate after import
        </label>
        <Button type="button" variant="secondary" onClick={() => doImport.mutate()}>
          Import approved products
        </Button>
        {doImport.data && (
          <span className="text-sm text-[color:var(--success)]">
            Created {doImport.data.created}, skipped {doImport.data.skipped}
          </span>
        )}
      </div>
      <div className="mt-4 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-[1400px] text-left text-xs">
          <thead className="bg-[color:var(--brand-cream)] uppercase">
            <tr>
              <th className="p-2">
                <input
                  type="checkbox"
                  onChange={(e) => setPicked(e.target.checked ? allIds : [])}
                  checked={picked.length === allIds.length && allIds.length > 0}
                />
              </th>
              <th className="p-2">Image</th>
              <th className="p-2">Brand / product</th>
              <th className="p-2">Category / form</th>
              <th className="p-2">Strength / count</th>
              <th className="p-2">Dietary</th>
              <th className="p-2">Source $</th>
              <th className="p-2">Demo $</th>
              <th className="p-2">Badges</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-[color:var(--border)] align-top">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={(e) =>
                      setPicked((cur) => (e.target.checked ? [...cur, p.id] : cur.filter((id) => id !== p.id)))
                    }
                  />
                </td>
                <td className="p-2">
                  <ProductThumb src={p.thumbnail_url} alt={p.name} className="h-14 w-14 rounded object-cover" />
                </td>
                <td className="p-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[color:var(--muted)]">{p.brand}{p.variant_name ? ` · ${p.variant_name}` : ""}</div>
                </td>
                <td className="p-2">
                  {p.primary_category}
                  <div>{p.form}</div>
                </td>
                <td className="p-2">
                  {p.strength_value != null ? `${p.strength_value} ${p.strength_unit ?? ""}` : "—"}
                  <div>{p.count ?? p.size ?? "—"}</div>
                </td>
                <td className="p-2">
                  {[p.vegan && "vegan", p.organic && "organic", p.gluten_free && "GF", p.non_gmo && "non-GMO"]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="p-2">{p.source_price_cents != null ? formatCents(p.source_price_cents) : "—"}</td>
                <td className="p-2">
                  <div>Demo {formatCents(p.regular_price_cents)}</div>
                  {p.sale_price_cents != null && (
                    <div>
                      −{p.discount_percent}% → {formatCents(p.sale_price_cents)}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  {p.official_bestseller ? "Bestseller " : ""}
                  {p.official_featured ? "Featured " : ""}
                  {p.price_is_demo ? "Demo pricing" : ""}
                </td>
                <td className="p-2">
                  <div>{p.status}</div>
                  <div>{p.image_status}</div>
                  <div>{p.source_policy_status}</div>
                  {p.duplicate_key ? <div>dup:{p.duplicate_key}</div> : null}
                  {p.validation_errors?.length ? <div className="text-[color:var(--danger)]">{p.validation_errors[0]}</div> : null}
                </td>
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <a className="text-[color:var(--brand-magenta)]" href={p.canonical_url} target="_blank" rel="noreferrer">
                      Source
                    </a>
                    <button type="button" onClick={() => setDrawer(p)}>
                      Preview
                    </button>
                    <button type="button" onClick={() => approve.mutate([p.id])}>
                      Approve
                    </button>
                    <button type="button" onClick={() => reject.mutate([p.id])}>
                      Reject
                    </button>
                    <button type="button" onClick={() => setDrawer(p)}>
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drawer && (
        <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-lg overflow-y-auto border-l bg-surface p-5 shadow-xl">
          <button type="button" className="text-sm" onClick={() => setDrawer(null)}>
            Close
          </button>
          <h2 className="mt-2 font-display text-2xl">{drawer.name}</h2>
          <p className="text-sm text-[color:var(--muted)]">{drawer.brand}</p>
          <ProductThumb src={drawer.thumbnail_url} alt={drawer.name} className="mt-3 h-40 w-40 rounded object-cover" />
          <p className="mt-3 text-sm">{drawer.short_description}</p>
          <p className="mt-2 text-xs">
            Extraction: {drawer.extraction_method} · Image: {drawer.image_use_status}
          </p>
          <label className="mt-4 block text-sm">
            Category
            <input
              className="mt-1 h-10 w-full rounded border px-2"
              defaultValue={drawer.primary_category ?? ""}
              onBlur={(e) =>
                patchStagedProduct(runId, drawer.id, { primary_category: e.target.value }).then(invalidate)
              }
            />
          </label>
          <label className="mt-3 block text-sm">
            Description
            <textarea
              className="mt-1 h-24 w-full rounded border px-2 py-1"
              defaultValue={drawer.short_description ?? ""}
              onBlur={(e) =>
                patchStagedProduct(runId, drawer.id, { short_description: e.target.value }).then(invalidate)
              }
            />
          </label>
          <div className="mt-4 rounded border bg-[color:var(--brand-cream)] p-3 text-xs">
            <div className="font-semibold">Source snapshot (normalized vs raw keys)</div>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(drawer.source_snapshot, null, 2)}
            </pre>
          </div>
        </aside>
      )}
    </div>
  );
}

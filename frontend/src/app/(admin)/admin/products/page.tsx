"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminArchiveProduct,
  adminDeleteProducts,
  adminDuplicateProduct,
  adminListBrands,
  adminProducts,
  adminUpdateProduct,
} from "@/lib/api/catalog";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { buttonVariants } from "@/components/ui/button";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";

export default function AdminProductsPage() {
  return <Suspense fallback={<p className="p-6">Loading products…</p>}><ProductsContent /></Suspense>;
}

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brand = searchParams.get("brand") ?? "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("");
  const [selection, setSelection] = useState<{ brand: string; products: Record<string, string> }>({ brand: "", products: {} });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const qc = useQueryClient();
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: adminListBrands });
  const list = useQuery({
    queryKey: ["admin-products", q, page, brand, category, availability],
    queryFn: () =>
      adminProducts({
        q: q || undefined,
        brand: brand || undefined,
        category: category || undefined,
        availability: availability || undefined,
        page,
        page_size: 25,
        sort: "newest",
      }),
  });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number | string; body: Record<string, unknown> }) =>
      adminUpdateProduct(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const rows = list.data?.items ?? [];
  const selected = selection.brand === brand ? selection.products : {};
  const selectedIds = Object.keys(selected);
  const visibleIds = rows.map((row) => String(row.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => id in selected);

  function changeBrand(slug: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (slug) next.set("brand", slug);
    else next.delete("brand");
    setSelection({ brand: slug, products: {} });
    setPage(1);
    router.push(`/admin/products${next.size ? `?${next}` : ""}`);
  }

  function toggleSelected(id: string, name: string, checked: boolean) {
    setSelection((current) => {
      const products = { ...(current.brand === brand ? current.products : {}) };
      if (checked) products[id] = name;
      else delete products[id];
      return { brand, products };
    });
  }

  async function deleteSelected() {
    if (deleteConfirmation !== "CONFIRM" || selectedIds.length === 0) return;
    setDeleteError("");
    try {
      const result = await adminDeleteProducts(selectedIds, deleteConfirmation);
      setDeleteNotice(`${result.deleted_products} product${result.deleted_products === 1 ? "" : "s"} deleted.${result.warning ? ` ${result.warning}` : ""}`);
      setSelection({ brand, products: {} });
      setDeleteOpen(false);
      setDeleteConfirmation("");
      setPage(1);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-products"] }),
        qc.invalidateQueries({ queryKey: ["admin-brands"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["filters"] }),
      ]);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Products could not be deleted.");
    }
  }

  const deleting = useMutation({ mutationFn: deleteSelected });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Select products to permanently delete their catalog records. Historical order details are retained.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/products/import" className={buttonVariants({ variant: "secondary" })}>
            Upload CSV
          </Link>
          <Link href="/admin/products/imports" className={buttonVariants({ variant: "secondary" })}>
            Import history
          </Link>
          <Link href="/admin/products/new" className={buttonVariants()}>
            Add product
          </Link>
        </div>
      </div>
      <input
        className="mt-6 h-11 w-full max-w-md rounded-[--radius] border border-[color:var(--border)] px-3"
        placeholder="Search name, UPC, SKU, or brand…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-[--radius] border border-[color:var(--border)] px-3 text-sm"
          aria-label="Filter products by brand"
          value={brand}
          onChange={(e) => changeBrand(e.target.value)}
        >
          <option value="">All brands</option>
          {(brands.data ?? []).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
        </select>
        <input
          className="h-10 rounded-[--radius] border border-[color:var(--border)] px-3 text-sm"
          placeholder="Category slug"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="h-10 rounded-[--radius] border border-[color:var(--border)] px-3 text-sm"
          value={availability}
          onChange={(e) => {
            setAvailability(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All availability</option>
          {["in_stock", "low_stock", "out_of_stock", "special_order", "coming_soon"].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-[color:var(--muted)]">{selectedIds.length} selected across pages</span>
        <button
          type="button"
          className="rounded-[--radius] border border-[color:var(--danger)] px-3 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-50"
          disabled={selectedIds.length === 0 || selectedIds.length > 100}
          onClick={() => { setDeleteOpen(true); setDeleteConfirmation(""); setDeleteError(""); }}
        >
          Delete selected
        </button>
        {selectedIds.length > 100 && <span className="text-sm text-[color:var(--danger)]">Select at most 100 products per deletion.</span>}
        {deleteNotice && <span role="status" className="text-sm text-[color:var(--brand-green-strong)]">{deleteNotice}</span>}
      </div>
      {list.isError && <p className="mt-4 text-[color:var(--danger)]">Failed to load products.</p>}
      <div className="mt-4 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--brand-cream)] text-xs uppercase">
            <tr>
              <th className="p-3">
                <input
                  type="checkbox"
                  aria-label="Select all products on this page"
                  checked={allVisibleSelected}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelection((current) => {
                      const products = { ...(current.brand === brand ? current.products : {}) };
                      for (const row of rows) {
                        if (checked) products[String(row.id)] = row.name;
                        else delete products[String(row.id)];
                      }
                      return { brand, products };
                    });
                  }}
                />
              </th>
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
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    checked={String(r.id) in selected}
                    onChange={(event) => toggleSelected(String(r.id), r.name, event.target.checked)}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <ProductThumb src={r.thumbnail_url} alt="" className="h-12 w-12 rounded object-cover" />
                    <div>
                      <Link href={`/admin/products/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <p className="text-xs text-[color:var(--muted)]">
                        {r.brand_name}
                        {r.is_demo ? " · Sample data" : ""}
                        {r.price_is_demo ? " · Sample pricing" : ""}
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
                    {["in_stock", "low_stock", "out_of_stock", "special_order", "coming_soon"].map((a) => (
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
      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4">
          <section role="dialog" aria-modal="true" aria-labelledby="bulk-delete-title" className="w-full max-w-lg rounded-[--radius-lg] bg-surface p-6 shadow-2xl">
            <h2 id="bulk-delete-title" className="font-display text-2xl font-semibold">Permanently delete {selectedIds.length} products?</h2>
            <p className="mt-3 text-sm text-[color:var(--muted)]">This removes their catalog records and images. Existing orders keep their saved product details. This cannot be undone.</p>
            <ul className="mt-3 max-h-32 overflow-y-auto text-sm" aria-label="Selected products">
              {selectedIds.map((id) => <li key={id}>{selected[id]}</li>)}
            </ul>
            <label className="mt-4 block text-sm font-medium">Type CONFIRM to continue
              <input autoFocus autoComplete="off" className="mt-1 h-11 w-full rounded-[--radius] border px-3" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />
            </label>
            {deleteError && <p role="alert" className="mt-3 text-sm text-[color:var(--danger)]">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="rounded-[--radius] border px-4 py-2" disabled={deleting.isPending} onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="button" className="rounded-[--radius] bg-[color:var(--danger)] px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={deleting.isPending || deleteConfirmation !== "CONFIRM"} onClick={() => deleting.mutate()}>
                {deleting.isPending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </section>
        </div>
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

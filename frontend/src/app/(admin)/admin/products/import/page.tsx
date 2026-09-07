"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

type PreviewRow = {
  source_row_number: number;
  detected_action: string;
  included: boolean;
  name: string | null;
  brand: string | null;
  category: string | null;
  supplier_sku: string | null;
  upc: string | null;
  size_original: string | null;
  form: string | null;
  form_original: string | null;
  strength_value: number | null;
  strength_unit: string | null;
  regular_price_cents: number | null;
  cost_price_cents: number | null;
  sale_price_cents: number | null;
  discount_percent: number | null;
  image_url: string | null;
  warnings: string[];
  errors: string[];
};

type Preview = {
  id: string;
  filename: string;
  detected_brand: string | null;
  already_imported: boolean;
    columns: Record<string, { header: string; index: number }>;
    header_cells?: string[];
    sections: { name: string }[];
  rows: PreviewRow[];
  stats: {
    total_detected: number;
    valid: number;
    new: number;
    updates: number;
    unchanged: number;
    errors: number;
    skipped: number;
    images_found: number;
  };
};

const DISCOUNTS = [0, 10, 20, 30, 40];
const MAP_FIELDS = [
  ["upc", "UPC"],
  ["supplier_sku", "Supplier SKU / Item #"],
  ["name", "Product name"],
  ["brand", "Brand"],
  ["category", "Category"],
  ["size", "Size"],
  ["form", "Form"],
  ["strength", "Strength"],
  ["regular_price", "Regular price / MSRP"],
  ["cost_price", "Wholesale / cost"],
  ["sale_price", "Sale price"],
  ["image", "Image URL"],
] as const;

export default function ProductImportPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState("Vital Planet");
  const [discount, setDiscount] = useState(0);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filter, setFilter] = useState("all");
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const visible = useMemo(() => {
    const rows = preview?.rows ?? [];
    if (filter === "all") return rows;
    if (filter === "warnings") return rows.filter((r) => (r.warnings?.length ?? 0) > 0);
    return rows.filter((r) => r.detected_action === filter);
  }, [preview, filter]);

  async function runPreview(nextStep: 2 | 3 = 3) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("brand_name", brand);
      if (discount) body.append("discount_percent", String(discount));
      if (Object.keys(columnMap).length) body.append("column_map", JSON.stringify(columnMap));
      const res = await fetch("/api/admin/catalog-imports", { method: "POST", body, credentials: "include" });
      const data = (await res.json()) as Preview & { detail?: string };
      if (!res.ok) {
        setError(data.detail || "Preview failed.");
        return;
      }
      setPreview(data);
      const nextMap: Record<string, number> = { ...columnMap };
      for (const [field, col] of Object.entries(data.columns || {})) {
        if (nextMap[field] == null) nextMap[field] = col.index;
      }
      setColumnMap(nextMap);
      setIncluded(new Set(data.rows.filter((r) => r.detected_action !== "error").map((r) => r.source_row_number)));
      setStep(nextStep);
    } finally {
      setPending(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    if (preview.stats.errors > 0) {
      setError("Resolve fatal validation errors before confirming.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog-imports/${preview.id}/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          included_row_numbers: [...included],
          force_reprocess: Boolean(preview.already_imported),
        }),
      });
      const data = (await res.json()) as Record<string, unknown> & { detail?: string };
      if (!res.ok) {
        setError(data.detail || "Commit failed.");
        return;
      }
      setResult(data);
      setStep(4);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Import products</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Upload, map, preview, then confirm. The catalog is not changed until you confirm.
      </p>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        {["Upload", "Map", "Preview", "Confirm"].map((label, i) => (
          <li
            key={label}
            className={i + 1 === step ? "text-[color:var(--brand-magenta)]" : "text-[color:var(--muted)]"}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="mt-6 max-w-lg space-y-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={!file}
            className={buttonVariants()}
            onClick={() => void runPreview(2)}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 max-w-lg space-y-4">
          <label className="block text-sm font-medium">
            Brand
            <input
              className="mt-1 h-11 w-full rounded-[--radius] border border-[color:var(--border)] px-3"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Default discount
            <select
              className="mt-1 h-11 w-full rounded-[--radius] border border-[color:var(--border)] px-3"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
            >
              {DISCOUNTS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "No discount" : `${d}%`}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">Column mapping</p>
            {MAP_FIELDS.map(([field, label]) => (
              <label key={field} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
                {label}
                <select
                  className="h-9 rounded border border-[color:var(--border)] px-2"
                  value={columnMap[field] ?? ""}
                  onChange={(e) =>
                    setColumnMap((m) => ({
                      ...m,
                      [field]: Number(e.target.value),
                    }))
                  }
                >
                  <option value="">Not mapped</option>
                  {(preview?.header_cells ?? []).map((header, idx) => (
                    <option key={`${header}-${idx}`} value={idx}>
                      {header || `Column ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {preview?.sections?.length ? (
            <p className="text-sm text-[color:var(--muted)]">
              Detected categories: {preview.sections.map((s) => s.name).join(", ")}
            </p>
          ) : null}
          <p className="text-sm text-[color:var(--muted)]">
            Columns are detected automatically. Correct any mapping before previewing. You can still
            exclude rows on the next screen.
          </p>
          <button type="button" disabled={pending} className={buttonVariants()} onClick={() => void runPreview(3)}>
            {pending ? "Parsing…" : "Preview import"}
          </button>
        </div>
      )}

      {step === 3 && preview && (
        <div className="mt-6">
          {preview.already_imported ? (
            <p className="mb-4 rounded-[--radius] border border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] p-3 text-sm">
              This file was imported before. Confirming again will reprocess it without creating duplicate UPCs.
            </p>
          ) : null}
          {preview.sections?.length ? (
            <p className="mb-3 text-sm text-[color:var(--muted)]">
              Categories: {preview.sections.map((s) => s.name).join(" · ")}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {Object.entries(preview.stats).map(([k, v]) => (
              <div key={k} className="rounded-[--radius] border border-[color:var(--border)] bg-surface p-3">
                <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">{k.replaceAll("_", " ")}</p>
                <p className="font-display text-2xl">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["all", "insert", "update", "error", "warnings", "skip"].map((f) => (
              <button
                key={f}
                type="button"
                className={buttonVariants({ variant: filter === f ? "primary" : "secondary" })}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[color:var(--brand-cream)] uppercase">
                <tr>
                  <th className="p-2">In</th>
                  <th className="p-2">Row</th>
                  <th className="p-2">Action</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Brand</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">SKU</th>
                  <th className="p-2">UPC</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Form</th>
                  <th className="p-2">MSRP</th>
                  <th className="p-2">Cost</th>
                  <th className="p-2">Sale</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.source_row_number} className="border-t border-[color:var(--border)]">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={included.has(row.source_row_number)}
                        onChange={() => {
                          const next = new Set(included);
                          if (next.has(row.source_row_number)) next.delete(row.source_row_number);
                          else next.add(row.source_row_number);
                          setIncluded(next);
                        }}
                      />
                    </td>
                    <td className="p-2">{row.source_row_number}</td>
                    <td className="p-2">{row.detected_action}</td>
                    <td className="p-2">{row.name}</td>
                    <td className="p-2">{row.brand}</td>
                    <td className="p-2">{row.category}</td>
                    <td className="p-2">{row.supplier_sku}</td>
                    <td className="p-2 font-mono">{row.upc}</td>
                    <td className="p-2">{row.size_original}</td>
                    <td className="p-2">{row.form_original || row.form}</td>
                    <td className="p-2">{row.regular_price_cents != null ? formatCents(row.regular_price_cents) : "—"}</td>
                    <td className="p-2">{row.cost_price_cents != null ? formatCents(row.cost_price_cents) : "—"}</td>
                    <td className="p-2">{row.sale_price_cents != null ? formatCents(row.sale_price_cents) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" disabled={pending} className={`${buttonVariants()} mt-4`} onClick={() => void confirm()}>
            {pending ? "Importing…" : "Confirm import"}
          </button>
        </div>
      )}

      {step === 4 && result && (
        <div className="mt-6 space-y-3">
          <p>Inserted {String(result.inserted_rows)}, updated {String(result.updated_rows)}, unchanged {String(result.unchanged_rows)}.</p>
          <Link href="/admin/products" className={buttonVariants()}>
            View products
          </Link>
        </div>
      )}

      {error ? <p className="mt-4 text-sm text-[color:var(--danger)]">{error}</p> : null}
    </div>
  );
}

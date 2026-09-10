"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, LoaderCircle, UploadCloud, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

type DuplicateMatch = {
  variant_id: string;
  product_id: string;
  product_name: string;
  matched_fields: string[];
};

type PreviewRow = {
  source_row_number: number;
  detected_action: "insert" | "conflict" | "update" | "unchanged" | "error" | "skip";
  included: boolean;
  name: string | null;
  brand: string | null;
  category: string | null;
  sku: string | null;
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
  availability: string;
  image_url: string | null;
  warnings: string[];
  errors: string[];
  duplicate_match?: DuplicateMatch;
  approved_existing_variant_id?: string | null;
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
    conflicts: number;
    blocking: number;
    updates: number;
    unchanged: number;
    errors: number;
    skipped: number;
    images_found: number;
  };
};

type EditDraft = Record<
  | "name"
  | "brand"
  | "category"
  | "sku"
  | "supplier_sku"
  | "upc"
  | "regular_price"
  | "sale_price"
  | "cost_price"
  | "availability"
  | "size"
  | "form"
  | "strength"
  | "image",
  string
>;

const DISCOUNTS = [0, 10, 20, 30, 40];
const MAX_CSV_BYTES = 10 * 1024 * 1024;
const AVAILABILITY = ["in_stock", "low_stock", "out_of_stock", "special_order", "discontinued"];
const MAP_FIELDS = [
  ["name", "Product full name *"],
  ["brand", "Brand *"],
  ["sku", "SKU"],
  ["supplier_sku", "Supplier SKU / Item #"],
  ["upc", "UPC"],
  ["regular_price", "MSRP *"],
  ["sale_price", "Store SRP"],
  ["cost_price", "Wholesale / cost"],
  ["discount", "Discount percent"],
  ["availability", "Availability"],
  ["category", "Category"],
  ["size", "Size"],
  ["form", "Form"],
  ["strength", "Strength"],
  ["image", "Image URL"],
] as const;

function dollars(cents: number | null) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function toDraft(row: PreviewRow): EditDraft {
  return {
    name: row.name ?? "",
    brand: row.brand ?? "",
    category: row.category ?? "",
    sku: row.sku ?? "",
    supplier_sku: row.supplier_sku ?? "",
    upc: row.upc ?? "",
    regular_price: dollars(row.regular_price_cents),
    sale_price: dollars(row.sale_price_cents),
    cost_price: dollars(row.cost_price_cents),
    availability: row.availability || "in_stock",
    size: row.size_original ?? "",
    form: row.form_original || row.form || "",
    strength:
      row.strength_value == null
        ? ""
        : `${row.strength_value}${row.strength_unit ? ` ${row.strength_unit}` : ""}`,
    image: row.image_url ?? "",
  };
}

function actionClass(action: PreviewRow["detected_action"]) {
  if (action === "conflict" || action === "error") return "bg-red-100 text-red-800";
  if (action === "update") return "bg-amber-100 text-amber-900";
  if (action === "insert") return "bg-green-100 text-green-800";
  return "bg-slate-100 text-slate-700";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadError(reason: unknown, fallback: string) {
  if (reason instanceof TypeError) {
    return "The upload service could not be reached. Check your connection and try again.";
  }
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function ActivityIndicator({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-3 py-2 text-sm font-medium text-[color:var(--brand-ink)] shadow-sm"
    >
      <LoaderCircle className="h-4 w-4 animate-spin text-[color:var(--brand-magenta)]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default function ProductImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState("");
  const [discount, setDiscount] = useState(0);
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filter, setFilter] = useState("all");
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [pendingRow, setPendingRow] = useState<number | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function chooseFile(nextFile: File | null) {
    setError(null);
    if (!nextFile) return;
    if (!nextFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Choose a .csv file. Excel workbooks must be saved as CSV first.");
      return;
    }
    if (nextFile.size > MAX_CSV_BYTES) {
      setFile(null);
      setError("This CSV is larger than 10 MB. Split it into smaller files and try again.");
      return;
    }
    setFile(nextFile);
    setPreview(null);
    setColumnMap({});
  }

  function removeFile() {
    setFile(null);
    setPreview(null);
    setColumnMap({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const visible = useMemo(() => {
    const rows = preview?.rows ?? [];
    if (filter === "all") return rows;
    if (filter === "warnings") return rows.filter((row) => (row.warnings?.length ?? 0) > 0);
    return rows.filter((row) => row.detected_action === filter);
  }, [preview, filter]);

  const blockingIncluded = useMemo(
    () =>
      (preview?.rows ?? []).filter(
        (row) => included.has(row.source_row_number) && ["conflict", "error"].includes(row.detected_action),
      ),
    [included, preview],
  );

  useEffect(() => {
    const batchId = new URLSearchParams(window.location.search).get("batch");
    if (!batchId) return;
    fetch(`/api/admin/catalog-imports/${encodeURIComponent(batchId)}`, { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json()) as Preview & { detail?: string };
        if (!res.ok) {
          setError(data.detail || "Could not resume this import review.");
          return;
        }
        setPreview(data);
        setIncluded(new Set(data.rows.filter((row) => row.included).map((row) => row.source_row_number)));
        setStep(3);
      })
      .catch(() => setError("Could not resume this import review."))
      .finally(() => {
        setPending(false);
        setActivity(null);
      });
  }, []);

  async function runPreview(nextStep: 2 | 3 = 3) {
    if (!file) return;
    setPending(true);
    setActivity(nextStep === 2 ? "Analyzing CSV columns and product rows..." : "Validating the mapped product data...");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      if (brand.trim()) body.append("brand_name", brand.trim());
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
      setIncluded(new Set(data.rows.map((row) => row.source_row_number)));
      setEditing(null);
      setDraft(null);
      if (nextStep === 3 && data.rows.length === 0) {
        setError("No product rows were found. Map Product full name, Brand, and MSRP, then try again.");
        setStep(2);
        return;
      }
      setStep(nextStep);
    } catch (reason) {
      setError(uploadError(reason, "The CSV could not be analyzed. Please try again."));
    } finally {
      setPending(false);
      setActivity(null);
    }
  }

  async function patchRow(sourceRowNumber: number, body: Record<string, unknown>) {
    if (!preview) return false;
    setPendingRow(sourceRowNumber);
    setActivity(
      "edits" in body
        ? `Saving and revalidating row ${sourceRowNumber}...`
        : `Checking row ${sourceRowNumber} against existing products...`,
    );
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog-imports/${preview.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_row_number: sourceRowNumber, ...body }),
      });
      const data = (await res.json()) as Preview & { detail?: string };
      if (!res.ok) {
        setError(data.detail || "Row validation failed.");
        return false;
      }
      setPreview(data);
      setIncluded(new Set(data.rows.filter((row) => row.included).map((row) => row.source_row_number)));
      return true;
    } catch (reason) {
      setError(uploadError(reason, `Could not update row ${sourceRowNumber}. Please try again.`));
      return false;
    } finally {
      setPendingRow(null);
      setActivity(null);
    }
  }

  async function updateSelection(next: Set<number>) {
    if (!preview) return;
    const previous = included;
    setIncluded(next);
    setPending(true);
    setActivity("Updating the rows included in this import...");
    setError(null);
    try {
      const res = await fetch(`/api/admin/catalog-imports/${preview.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included_row_numbers: [...next] }),
      });
      const data = (await res.json()) as Preview & { detail?: string };
      if (!res.ok) {
        setIncluded(previous);
        setError(data.detail || "Could not update the row selection.");
        return;
      }
      setPreview(data);
      setIncluded(new Set(data.rows.filter((row) => row.included).map((row) => row.source_row_number)));
    } catch (reason) {
      setIncluded(previous);
      setError(uploadError(reason, "Could not update the row selection. Please try again."));
    } finally {
      setPending(false);
      setActivity(null);
    }
  }

  async function saveEdit() {
    if (editing == null || !draft) return;
    if (await patchRow(editing, { edits: draft })) {
      setEditing(null);
      setDraft(null);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    if (blockingIncluded.length) {
      setError("Resolve the highlighted conflicts and errors, or exclude those rows before confirming.");
      return;
    }
    if (!included.size) {
      setError("Select at least one row to import.");
      return;
    }
    setPending(true);
    setActivity(`Writing ${included.size} product row${included.size === 1 ? "" : "s"} to the database...`);
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
        setError(data.detail || "Import failed.");
        return;
      }
      setResult(data);
      setStep(4);
    } catch (reason) {
      setError(uploadError(reason, "The products could not be written to the database. Please try again."));
    } finally {
      setPending(false);
      setActivity(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Import products</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Upload, map, review, then approve. No product is written to the database before final approval.
      </p>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        {["Upload", "Map", "Review", "Confirm"].map((label, index) => (
          <li
            key={label}
            className={index + 1 === step ? "text-[color:var(--brand-magenta)]" : "text-[color:var(--muted)]"}
          >
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <div role="alert" className="mt-4 max-w-3xl rounded-[--radius] border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">Import needs attention</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {activity ? <ActivityIndicator label={activity} /> : null}

      {step === 1 && (
        <div className="mt-6 max-w-2xl space-y-5">
          <div
            className={`rounded-[--radius] border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? "border-[color:var(--brand-magenta)] bg-[color:var(--brand-cream)]"
                : "border-[color:var(--border)] bg-surface"
            }`}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              chooseFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input
              ref={fileInputRef}
              id="product-csv-file"
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            <UploadCloud className="mx-auto h-9 w-9 text-[color:var(--brand-magenta)]" aria-hidden="true" />
            <p className="mt-3 font-semibold">Drop your product CSV here</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">or choose a file from your computer, up to 10 MB</p>
            <button
              type="button"
              className={`${buttonVariants({ variant: "secondary" })} mt-4`}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose CSV file
            </button>
          </div>

          {file ? (
            <div className="flex items-center gap-3 rounded-[--radius] border border-green-200 bg-green-50 p-3">
              <FileSpreadsheet className="h-8 w-8 shrink-0 text-green-700" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-semibold text-green-950">{file.name}</p>
                <p className="text-green-800">{formatFileSize(file.size)} · Ready to analyze</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" />
              <button type="button" className="rounded p-1 text-green-900 hover:bg-green-100" onClick={removeFile} aria-label="Remove selected CSV">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <button type="button" disabled={!file || pending} className={buttonVariants()} onClick={() => void runPreview(2)}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Analyzing CSV..." : "Analyze CSV"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 max-w-2xl space-y-4">
          <label className="block text-sm font-medium">
            Default brand (only used when a row has no brand)
            <input
              className="mt-1 h-11 w-full rounded-[--radius] border border-[color:var(--border)] px-3"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block text-sm font-medium">
            Default discount
            <select
              className="mt-1 h-11 w-full rounded-[--radius] border border-[color:var(--border)] px-3"
              value={discount}
              onChange={(event) => setDiscount(Number(event.target.value))}
            >
              {DISCOUNTS.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Use Store SRP / brand rule" : `${value}% fallback`}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 rounded-[--radius] border border-[color:var(--border)] bg-surface p-4">
            <div>
              <p className="font-medium">Column mapping</p>
              <p className="text-xs text-[color:var(--muted)]">
                The engine suggested these matches. Correct any field before generating the review.
              </p>
            </div>
            {MAP_FIELDS.map(([field, label]) => (
              <label key={field} className="grid grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)] items-center gap-3 text-sm">
                {label}
                <select
                  className="h-9 rounded border border-[color:var(--border)] px-2"
                  value={columnMap[field] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setColumnMap((current) => {
                      const next = { ...current };
                      if (value === "") delete next[field];
                      else next[field] = Number(value);
                      return next;
                    });
                  }}
                >
                  <option value="">Not mapped</option>
                  {(preview?.header_cells ?? []).map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {preview?.sections?.length ? (
            <p className="text-sm text-[color:var(--muted)]">
              Detected categories: {preview.sections.map((section) => section.name).join(", ")}
            </p>
          ) : null}
          <button type="button" disabled={pending} className={buttonVariants()} onClick={() => void runPreview(3)}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {pending ? "Validating..." : "Generate review"}
          </button>
        </div>
      )}

      {step === 3 && preview && (
        <div className="mt-6">
          {preview.already_imported ? (
            <p className="mb-4 rounded-[--radius] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              This exact file was imported before. Existing products are blocked until you explicitly approve each update.
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {Object.entries(preview.stats).map(([key, value]) => (
              <div key={key} className="rounded-[--radius] border border-[color:var(--border)] bg-surface p-3">
                <p className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">{key.replaceAll("_", " ")}</p>
                <p className="font-display text-2xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {["all", "insert", "conflict", "update", "error", "warnings", "skip"].map((value) => (
              <button
                key={value}
                type="button"
                className={buttonVariants({ variant: filter === value ? "primary" : "secondary" })}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-[color:var(--border)]" aria-hidden="true" />
            <button
              type="button"
              disabled={pending}
              className={buttonVariants({ variant: "secondary" })}
              onClick={() => void updateSelection(new Set(preview.rows.map((row) => row.source_row_number)))}
            >
              Include all
            </button>
            <button
              type="button"
              disabled={pending}
              className={buttonVariants({ variant: "secondary" })}
              onClick={() =>
                void updateSelection(
                  new Set(
                    preview.rows
                      .filter((row) => !["conflict", "error"].includes(row.detected_action))
                      .map((row) => row.source_row_number),
                  ),
                )
              }
            >
              Exclude blocking rows
            </button>
          </div>

          {editing != null && draft ? (
            <div className="mt-4 rounded-[--radius] border border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Edit CSV row {editing}</h2>
                <button type="button" className="text-sm underline" onClick={() => { setEditing(null); setDraft(null); }}>
                  Cancel
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  ["name", "Product full name *"],
                  ["brand", "Brand *"],
                  ["category", "Category"],
                  ["sku", "SKU"],
                  ["supplier_sku", "Supplier SKU"],
                  ["upc", "UPC"],
                  ["regular_price", "MSRP *"],
                  ["sale_price", "Store SRP"],
                  ["cost_price", "Cost"],
                  ["size", "Size"],
                  ["form", "Form"],
                  ["strength", "Strength"],
                  ["image", "Image URL"],
                ] as const).map(([field, label]) => (
                  <label key={field} className={`text-xs font-medium ${field === "image" ? "sm:col-span-2" : ""}`}>
                    {label}
                    <input
                      className="mt-1 h-10 w-full rounded border border-[color:var(--border)] bg-white px-2 text-sm"
                      value={draft[field]}
                      onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                    />
                  </label>
                ))}
                <label className="text-xs font-medium">
                  Availability
                  <select
                    className="mt-1 h-10 w-full rounded border border-[color:var(--border)] bg-white px-2 text-sm"
                    value={draft.availability}
                    onChange={(event) => setDraft({ ...draft, availability: event.target.value })}
                  >
                    {AVAILABILITY.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <button
                type="button"
                disabled={pendingRow === editing}
                className={`${buttonVariants()} mt-4`}
                onClick={() => void saveEdit()}
              >
                {pendingRow === editing ? "Revalidating..." : "Save and revalidate"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[color:var(--brand-cream)] uppercase">
                <tr>
                  <th className="p-2">In</th>
                  <th className="p-2">Row</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Product</th>
                  <th className="p-2">Identifiers</th>
                  <th className="p-2">Availability</th>
                  <th className="p-2">MSRP</th>
                  <th className="p-2">Store SRP</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.source_row_number} className="border-t border-[color:var(--border)] align-top">
                    <td className="p-2">
                      <input
                        aria-label={`Include row ${row.source_row_number}`}
                        type="checkbox"
                        checked={included.has(row.source_row_number)}
                        disabled={pending}
                        onChange={() => {
                          const next = new Set(included);
                          if (next.has(row.source_row_number)) next.delete(row.source_row_number);
                          else next.add(row.source_row_number);
                          void updateSelection(next);
                        }}
                      />
                    </td>
                    <td className="p-2">{row.source_row_number}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-1 font-semibold ${actionClass(row.detected_action)}`}>
                        {row.detected_action}
                      </span>
                    </td>
                    <td className="min-w-56 p-2">
                      <p className="font-medium">{row.name || "Missing name"}</p>
                      <p className="text-[color:var(--muted)]">{row.brand || "Missing brand"}{row.category ? ` · ${row.category}` : ""}</p>
                      {row.errors.map((message) => <p key={message} className="mt-1 text-[color:var(--danger)]">{message}</p>)}
                      {row.warnings.map((message) => <p key={message} className="mt-1 text-amber-800">{message}</p>)}
                    </td>
                    <td className="min-w-44 p-2 font-mono">
                      <p>SKU: {row.sku || "—"}</p>
                      <p>Supplier: {row.supplier_sku || "—"}</p>
                      <p>UPC: {row.upc || "—"}</p>
                      {row.duplicate_match ? (
                        <p className="mt-1 font-sans text-[color:var(--danger)]">
                          Matches {row.duplicate_match.product_name} by {row.duplicate_match.matched_fields.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-2">{row.availability || "in_stock"}</td>
                    <td className="p-2">{row.regular_price_cents != null ? formatCents(row.regular_price_cents) : "—"}</td>
                    <td className="p-2">{row.sale_price_cents != null ? formatCents(row.sale_price_cents) : "—"}</td>
                    <td className="min-w-36 space-y-2 p-2">
                      <button
                        type="button"
                        className="block text-[color:var(--brand-magenta)] underline"
                        onClick={() => { setEditing(row.source_row_number); setDraft(toDraft(row)); }}
                      >
                        Edit row
                      </button>
                      {row.detected_action === "conflict" && row.duplicate_match ? (
                        <button
                          type="button"
                          disabled={pendingRow === row.source_row_number}
                          className="block text-left font-semibold text-amber-800 underline"
                          onClick={() => void patchRow(row.source_row_number, { resolution: "update_existing" })}
                        >
                          {pendingRow === row.source_row_number ? "Checking..." : "Approve existing-product update"}
                        </button>
                      ) : null}
                      {row.approved_existing_variant_id ? (
                        <button
                          type="button"
                          disabled={pendingRow === row.source_row_number}
                          className="block text-[color:var(--muted)] underline"
                          onClick={() => void patchRow(row.source_row_number, { resolution: "clear" })}
                        >
                          Undo update approval
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={pending || blockingIncluded.length > 0 || included.size === 0}
              className={buttonVariants()}
              onClick={() => void confirmImport()}
            >
              {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {pending ? "Writing to database..." : `Approve and import ${included.size} rows`}
            </button>
            {blockingIncluded.length ? (
              <p className="text-sm font-medium text-[color:var(--danger)]">
                {blockingIncluded.length} included row{blockingIncluded.length === 1 ? " is" : "s are"} blocking approval.
              </p>
            ) : (
              <p className="text-sm text-[color:var(--muted)]">All included rows passed server validation.</p>
            )}
          </div>
        </div>
      )}

      {step === 4 && result && (
        <div className="mt-6 space-y-3 rounded-[--radius] border border-green-300 bg-green-50 p-5">
          <h2 className="font-display text-2xl font-semibold">Import complete</h2>
          <p>
            Inserted {String(result.inserted_rows)}, updated {String(result.updated_rows)}, unchanged {String(result.unchanged_rows)}, skipped {String(result.skipped_rows)}.
          </p>
          <Link href="/admin/products" className={buttonVariants()}>
            View products
          </Link>
        </div>
      )}

    </div>
  );
}

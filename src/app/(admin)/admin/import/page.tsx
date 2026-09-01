"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { buttonVariants } from "@/components/ui/button";

type Preview = {
  filename: string | null;
  total_rows: number;
  creatable: number;
  updatable: number;
  invalid: number;
  rows: {
    line: number;
    action: string;
    name: string | null;
    sku: string | null;
    errors: string[];
    warnings: string[];
  }[];
};

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(path: "preview" | "commit") {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const data = await apiFetch<Preview & { message?: string }>(
        `/api/v1/admin/products/bulk-import/${path}`,
        { method: "POST", body: fd },
      );
      if (path === "preview") setPreview(data);
      else setResult(data.message ?? "Committed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">CSV catalog import</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Imported rows enter a review state (inactive) until you activate them. Download the
        template, preview, then commit only valid rows.
      </p>
      <a
        className="mt-4 inline-block text-sm font-semibold text-[color:var(--brand-magenta)]"
        href="/api/v1/admin/products/bulk-import/template"
      >
        Download CSV template
      </a>
      <input
        className="mt-6 block"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="mt-4 flex gap-3">
        <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => run("preview")}>
          Preview (dry run)
        </button>
        <button type="button" className={buttonVariants()} onClick={() => run("commit")}>
          Commit valid rows
        </button>
      </div>
      {error && <p className="mt-3 text-[color:var(--danger)]">{error}</p>}
      {result && <p className="mt-3 text-[color:var(--success)]">{result}</p>}
      {preview && (
        <div className="mt-6 overflow-x-auto text-sm">
          <p>
            {preview.total_rows} rows · {preview.creatable} new · {preview.updatable} updates ·{" "}
            {preview.invalid} invalid
          </p>
          <table className="mt-3 w-full border">
            <thead>
              <tr className="bg-[color:var(--brand-cream)] text-left">
                <th className="p-2">Line</th>
                <th className="p-2">Action</th>
                <th className="p-2">Name</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Errors</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.line} className="border-t">
                  <td className="p-2">{r.line}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.sku}</td>
                  <td className="p-2 text-[color:var(--danger)]">{r.errors.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

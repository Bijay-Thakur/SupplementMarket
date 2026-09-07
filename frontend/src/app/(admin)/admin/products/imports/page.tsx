"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Batch = {
  id: string;
  filename: string;
  status: string;
  inserted_rows?: number;
  updated_rows?: number;
  unchanged_rows?: number;
  created_at?: string;
};

export default function ImportHistoryPage() {
  const [items, setItems] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/catalog-imports", { credentials: "include" })
      .then(async (res) => {
        const data = (await res.json()) as { items?: Batch[]; detail?: string };
        if (!res.ok) {
          setError(data.detail || "Could not load import history.");
          return;
        }
        setItems(data.items ?? []);
      })
      .catch(() => setError("Could not load import history."));
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Import history</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">Previous confirmed CSV catalog imports.</p>
      <Link href="/admin/products/import" className="mt-4 inline-block text-sm text-[color:var(--brand-magenta)]">
        Start a new import
      </Link>
      {error ? <p className="mt-4 text-sm text-[color:var(--danger)]">{error}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--brand-cream)] text-xs uppercase">
            <tr>
              <th className="p-3">File</th>
              <th className="p-3">Status</th>
              <th className="p-3">Inserted</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Unchanged</th>
              <th className="p-3">When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((batch) => (
              <tr key={batch.id} className="border-t border-[color:var(--border)]">
                <td className="p-3">{batch.filename}</td>
                <td className="p-3">{batch.status}</td>
                <td className="p-3">{batch.inserted_rows ?? "—"}</td>
                <td className="p-3">{batch.updated_rows ?? "—"}</td>
                <td className="p-3">{batch.unchanged_rows ?? "—"}</td>
                <td className="p-3">{batch.created_at ? String(batch.created_at).slice(0, 19) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

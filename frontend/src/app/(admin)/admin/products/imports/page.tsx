"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

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
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/catalog-imports", { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as { items?: Batch[]; detail?: string };
        if (!response.ok) throw new Error(data.detail || "Could not load import history.");
        setItems(data.items ?? []);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Could not load import history."),
      )
      .finally(() => setLoading(false));
  }, []);

  async function deleteImport() {
    if (!deleteTarget || confirmation !== "CONFIRM") return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/catalog-imports/${encodeURIComponent(deleteTarget.id)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmation }),
        },
      );
      const data = (await response.json()) as {
        detail?: string;
        deleted_products?: number;
        retained_updated_products?: number;
        warning?: string;
      };
      if (!response.ok) throw new Error(data.detail || "Could not delete this import.");

      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      const deleted = data.deleted_products ?? 0;
      const retained = data.retained_updated_products ?? 0;
      setNotice(
        `Import deleted. ${deleted} product${deleted === 1 ? "" : "s"} created by it removed.` +
          (retained
            ? ` ${retained} pre-existing product${retained === 1 ? " was" : "s were"} retained.`
            : "") +
          (data.warning ? ` ${data.warning}` : ""),
      );
      setDeleteTarget(null);
      setConfirmation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this import.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Import history</h1>
      <p className="mt-1 text-sm text-[color:var(--muted)]">Pending reviews and completed CSV catalog imports.</p>
      <Link href="/admin/products/import" className={`${buttonVariants()} mt-4`}>
        Start a new import
      </Link>
      {error ? <p className="mt-4 text-sm text-[color:var(--danger)]">{error}</p> : null}
      {notice ? (
        <p
          className="mt-4 rounded-[--radius] border border-green-200 bg-green-50 p-3 text-sm text-green-900"
          role="status"
        >
          {notice}
        </p>
      ) : null}
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
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[color:var(--muted)]">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    Loading imports…
                  </span>
                </td>
              </tr>
            ) : null}
            {items.map((batch) => (
              <tr key={batch.id} className="border-t border-[color:var(--border)]">
                <td className="p-3">{batch.filename}</td>
                <td className="p-3">{batch.status}</td>
                <td className="p-3">{batch.inserted_rows ?? "—"}</td>
                <td className="p-3">{batch.updated_rows ?? "—"}</td>
                <td className="p-3">{batch.unchanged_rows ?? "—"}</td>
                <td className="p-3">{batch.created_at ? String(batch.created_at).slice(0, 19) : "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-3">
                    {batch.status === "awaiting_confirmation" ? (
                      <Link
                        href={`/admin/products/import?batch=${encodeURIComponent(batch.id)}`}
                        className="text-[color:var(--brand-magenta)] underline"
                      >
                        Resume review
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={batch.status === "processing"}
                      className="text-[color:var(--danger)] underline disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        setDeleteTarget(batch);
                        setConfirmation("");
                        setError(null);
                      }}
                    >
                      Delete import
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[color:var(--muted)]">
                  No imports yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-import-title"
            className="w-full max-w-lg rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-6 shadow-2xl"
          >
            <h2 id="delete-import-title" className="font-display text-2xl font-semibold">
              Delete this import?
            </h2>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This permanently deletes the batch and products created by it. Products that existed before this
              import and were only updated are retained. This cannot be undone.
            </p>
            <p className="mt-3 break-all text-sm"><strong>File:</strong> {deleteTarget.filename}</p>
            <label className="mt-5 block text-sm font-medium">
              Type CONFIRM to continue
              <input
                autoFocus
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                autoComplete="off"
              />
            </label>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmation("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={deleting || confirmation !== "CONFIRM"}
                onClick={deleteImport}
                className="bg-[color:var(--danger)] hover:brightness-90"
              >
                {deleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Deleting…
                  </>
                ) : "Delete permanently"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

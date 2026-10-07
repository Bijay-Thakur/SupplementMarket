"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { requestStatuses, type SupplementRequest } from "@/lib/requests/schema";
import { requestJson } from "@/lib/requests/client";

export default function AdminRequestsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin-requests", page, status], queryFn: () => requestJson<{ items: SupplementRequest[]; total: number }>(`/api/admin/supplement-requests?page=${page}&status=${status}`), refetchInterval: 15_000 });
  async function update(id: string, next: string) {
    setSaving(id); setError(null);
    try {
      await requestJson("/api/admin/supplement-requests", { method: "PATCH", body: JSON.stringify({ id, status: next }) });
      await Promise.all([client.invalidateQueries({ queryKey: ["admin-requests"] }), client.invalidateQueries({ queryKey: ["admin-request-count"] })]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save status."); }
    finally { setSaving(null); }
  }
  return <section>
    <h1 className="font-display text-3xl font-semibold">Special requests</h1>
    <p className="mt-2 text-[color:var(--muted)]">Supplement inquiries from customers and guests. Contact the requester to confirm availability and pricing.</p>
    <label className="my-5 block text-sm">Status <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="ml-3 rounded-lg border border-stone-300 bg-white p-2"><option value="">All requests</option>{requestStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
    {error && <p role="alert" className="mb-4 text-[color:var(--danger)]">{error}</p>}
    {query.isPending && <p role="status" className="flex items-center gap-2 py-10"><LoaderCircle className="h-5 w-5 animate-spin" />Loading requests…</p>}
    {query.isError && <p role="alert">Could not load requests. <button className="underline" onClick={() => void query.refetch()}>Try again</button></p>}
    {query.isSuccess && !query.data.items.length && <p className="rounded-xl border bg-white p-8">No requests match this view.</p>}
    <div className="space-y-4">{query.data?.items.map((item) => <article key={item.id} className="rounded-xl border border-[color:var(--border)] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-display text-xl font-semibold">{item.supplement_name}</h2><p className="mt-1 text-sm text-[color:var(--muted)]">{new Date(item.created_at).toLocaleString()}</p></div>
        <label className="text-sm">Status <select aria-label={`Status for ${item.supplement_name}`} disabled={saving !== null} value={item.status} onChange={(e) => void update(item.id, e.target.value)} className="ml-2 rounded-lg border border-stone-300 p-2">{requestStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm lg:grid-cols-5">{([['Brand', item.brand], ['UPC', item.upc], ['Size', item.size], ['Strength', item.strength], ['Form', item.form]] as const).map(([label, value]) => <div key={label}><dt className="text-[color:var(--muted)]">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Not provided"}</dd></div>)}</dl>
      <div className="mt-5 border-t border-[color:var(--border)] pt-4 text-sm"><p className="font-semibold">{item.customer_name}</p><p className="mt-1 break-words">{item.email}{item.phone ? ` · ${item.phone}` : ""}</p>{item.notes && <p className="mt-3 whitespace-pre-wrap break-words">{item.notes}</p>}</div>
    </article>)}</div>
    {query.data && <nav aria-label="Request pages" className="mt-6 flex items-center gap-4"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Previous</button><span aria-current="page">Page {page} of {Math.max(1, Math.ceil(query.data.total / 25))}</span><button disabled={page * 25 >= query.data.total} onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 disabled:opacity-40">Next</button></nav>}
  </section>;
}

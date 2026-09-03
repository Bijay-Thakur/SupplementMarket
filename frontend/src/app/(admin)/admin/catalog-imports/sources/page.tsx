"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { catalogSources, patchCatalogSource } from "@/lib/api/catalog";

export default function CatalogSourcesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["catalog-sources"], queryFn: catalogSources });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: unknown }) => patchCatalogSource(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog-sources"] }),
  });
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Catalog sources</h1>
      <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
        Official manufacturer sites only. Policy status comes from robots.txt. Blocked sources are
        skipped — products are never fabricated.
      </p>
      <div className="mt-6 overflow-x-auto rounded-[--radius] border border-[color:var(--border)] bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[color:var(--brand-cream)] text-xs uppercase">
            <tr>
              <th className="p-3">Brand</th>
              <th className="p-3">Official URL</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Limit</th>
              <th className="p-3">Policy</th>
              <th className="p-3">Last result</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-[color:var(--border)] align-top">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-[color:var(--muted)]">{s.slug}</div>
                </td>
                <td className="p-3">
                  <a className="text-[color:var(--brand-magenta)] underline" href={s.official_url} target="_blank" rel="noreferrer">
                    {s.domain}
                  </a>
                </td>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => patch.mutate({ id: s.id, body: { enabled: e.target.checked } })}
                  />
                </td>
                <td className="p-3">
                  <input
                    className="h-9 w-16 rounded border px-2"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={s.product_limit}
                    onBlur={(e) =>
                      patch.mutate({ id: s.id, body: { product_limit: Number(e.target.value) } })
                    }
                  />
                </td>
                <td className="p-3">
                  <div>{s.policy_status}</div>
                  <p className="mt-1 max-w-xs text-xs text-[color:var(--muted)]">{s.policy_notes}</p>
                </td>
                <td className="p-3 text-xs">{s.last_result ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

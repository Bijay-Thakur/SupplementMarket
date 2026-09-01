"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { catalogSources, createCatalogImport } from "@/lib/api/catalog";
import { Button } from "@/components/ui/button";

export default function NewCatalogImportPage() {
  const router = useRouter();
  const sources = useQuery({ queryKey: ["catalog-sources"], queryFn: catalogSources });
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(6);
  const [images, setImages] = useState(true);
  const [dry, setDry] = useState(false);
  const [priority, setPriority] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createCatalogImport({
        brand_slugs: selected.length ? selected : (sources.data ?? []).filter((s) => s.enabled).map((s) => s.slug),
        per_brand_limit: limit,
        download_images: images,
        dry_run: dry,
        prioritize_categories: priority
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        collect_now: true,
      }),
    onSuccess: (run) => router.push(`/admin/catalog-imports/${run.id}`),
  });

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">New collection</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Images are for local demo review only. Do not treat them as approved for production until
        written manufacturer permission or an authorized retailer asset feed is on file.
      </p>
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Brands</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(sources.data ?? []).map((s) => (
            <label key={s.slug} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(s.slug)}
                disabled={!s.enabled}
                onChange={(e) =>
                  setSelected((cur) =>
                    e.target.checked ? [...cur, s.slug] : cur.filter((x) => x !== s.slug),
                  )
                }
              />
              <span>
                {s.name}
                <span className="ml-1 text-xs text-[color:var(--muted)]">({s.policy_status})</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-[color:var(--muted)]">Leave unchecked to collect every enabled source.</p>
      </fieldset>
      <label className="mt-4 block text-sm">
        Per-brand product limit
        <input
          className="ml-2 h-9 w-20 rounded border px-2"
          type="number"
          min={1}
          max={12}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        />
      </label>
      <label className="mt-3 block text-sm">
        Categories to prioritize (comma-separated)
        <input
          className="mt-1 h-11 w-full rounded border px-3"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          placeholder="Multivitamins, Vitamin D, Omega Oils"
        />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
        Download manufacturer images when robots.txt allows
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={dry} onChange={(e) => setDry(e.target.checked)} />
        Dry run (skip image files)
      </label>
      <p className="mt-4 text-sm text-[color:var(--muted)]">
        On the hosted demo this records that live collection is local-only. The
        storefront catalog is already imported from official manufacturer pages.
      </p>
      {create.isError && <p className="mt-3 text-[color:var(--danger)]">{String(create.error.message)}</p>}
      <Button className="mt-6" type="button" onClick={() => create.mutate()} disabled={create.isPending}>
        {create.isPending ? "Starting…" : "Begin collection"}
      </Button>
    </div>
  );
}

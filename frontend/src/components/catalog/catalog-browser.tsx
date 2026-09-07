"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFilters, listProducts } from "@/lib/api/catalog";
import { ProductGrid, ProductGridSkeleton } from "./product-grid";
import { DIETARY_LABELS } from "@/lib/catalog-copy";
import { cn } from "@/lib/utils/cn";
import { Container } from "@/components/ui/container";
import { SampleCatalogNotice } from "@/components/catalog/sample-catalog-notice";

function setParam(sp: URLSearchParams, key: string, value: string | null) {
  if (!value) sp.delete(key);
  else sp.set(key, value);
}

export function CatalogBrowser({
  title,
  description,
  locked,
}: {
  title: string;
  description?: string;
  locked?: { on_sale?: boolean; is_new?: boolean; bestseller?: boolean; category?: string; brand?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const brand = locked?.brand || sp.get("brand") || undefined;
  const category = locked?.category || sp.get("category") || undefined;
  const form = sp.get("form") || undefined;
  const availability = sp.get("availability") || undefined;
  const dietary = sp.getAll("dietary");
  const onSale = locked?.on_sale ?? (sp.get("on_sale") === "1" ? true : undefined);
  const isNew = locked?.is_new ?? (sp.get("is_new") === "1" ? true : undefined);
  const bestseller = locked?.bestseller ?? (sp.get("bestseller") === "1" ? true : undefined);
  const sort = sp.get("sort") || "relevance";
  const page = Number(sp.get("page") || "1");

  const [filtersOpen, setFiltersOpen] = useState(false);

  function update(mut: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(sp.toString());
    mut(next);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  const query = useQuery({
    queryKey: ["products", { q, brand, category, form, availability, dietary, onSale, isNew, bestseller, sort, page }],
    queryFn: () =>
      listProducts({
        q: q || undefined,
        brand,
        category,
        form,
        availability,
        dietary: dietary.length ? dietary : undefined,
        on_sale: onSale,
        is_new: isNew,
        bestseller,
        sort,
        page,
        page_size: 24,
      }),
  });

  const filters = useQuery({ queryKey: ["filters"], queryFn: getFilters });

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (q) chips.push({ key: "q", label: `Search: ${q}`, clear: () => update((n) => n.delete("q")) });
  if (brand && !locked?.brand)
    chips.push({ key: "brand", label: `Brand: ${brand}`, clear: () => update((n) => n.delete("brand")) });
  if (category && !locked?.category)
    chips.push({
      key: "category",
      label: `Category: ${category}`,
      clear: () => update((n) => n.delete("category")),
    });
  if (form) chips.push({ key: "form", label: `Form: ${form}`, clear: () => update((n) => n.delete("form")) });
  if (availability)
    chips.push({
      key: "availability",
      label: availability.replace("_", " "),
      clear: () => update((n) => n.delete("availability")),
    });
  dietary.forEach((d) =>
    chips.push({
      key: d,
      label: DIETARY_LABELS[d] ?? d,
      clear: () =>
        update((n) => {
          const all = n.getAll("dietary").filter((x) => x !== d);
          n.delete("dietary");
          all.forEach((x) => n.append("dietary", x));
        }),
    }),
  );

  return (
    <Container className="py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[color:var(--muted)]">{description}</p>}
        <SampleCatalogNotice />
      </div>

      <div className="mb-4 lg:hidden">
        <button
          type="button"
          className="h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface text-sm font-semibold"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? "Hide filters" : "Show filters"}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className={cn("space-y-6 text-sm", !filtersOpen && "hidden lg:block")}>
          <FilterGroup label="Brand">
            {(filters.data?.brands ?? []).map((b) => (
              <FilterLink
                key={b.slug}
                active={brand === b.slug}
                label={`${b.name} (${b.count})`}
                onClick={() =>
                  update((n) => setParam(n, "brand", brand === b.slug ? null : b.slug))
                }
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Category">
            {(filters.data?.categories ?? []).map((c) => (
              <FilterLink
                key={c.slug}
                active={category === c.slug}
                label={`${c.name} (${c.count})`}
                onClick={() =>
                  update((n) => setParam(n, "category", category === c.slug ? null : c.slug))
                }
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Form">
            {(filters.data?.forms ?? []).map((f) => (
              <FilterLink
                key={f.value}
                active={form === f.value}
                label={`${f.value} (${f.count})`}
                onClick={() =>
                  update((n) => setParam(n, "form", form === f.value ? null : f.value))
                }
              />
            ))}
          </FilterGroup>
          <FilterGroup label="Dietary">
            {(filters.data?.dietary ?? Object.keys(DIETARY_LABELS)).map((d) => (
              <label key={d} className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  checked={dietary.includes(d)}
                  onChange={() =>
                    update((n) => {
                      const all = n.getAll("dietary");
                      n.delete("dietary");
                      const next = all.includes(d) ? all.filter((x) => x !== d) : [...all, d];
                      next.forEach((x) => n.append("dietary", x));
                    })
                  }
                />
                {DIETARY_LABELS[d] ?? d}
              </label>
            ))}
          </FilterGroup>
          <FilterGroup label="Availability">
            {["in_stock", "low_stock", "out_of_stock", "coming_soon"].map((a) => (
              <FilterLink
                key={a}
                active={availability === a}
                label={a.replaceAll("_", " ")}
                onClick={() =>
                  update((n) => setParam(n, "availability", availability === a ? null : a))
                }
              />
            ))}
          </FilterGroup>
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[color:var(--muted)]">
              {query.data ? `${query.data.total} products` : "Loading…"}
            </p>
            <label className="text-sm">
              Sort{" "}
              <select
                className="ml-2 h-10 rounded-[--radius] border border-[color:var(--border)] bg-surface px-2"
                value={sort}
                onChange={(e) => update((n) => setParam(n, "sort", e.target.value))}
              >
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="name_asc">Name A–Z</option>
                <option value="newest">Newest</option>
                <option value="discount">Biggest savings</option>
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.clear}
                  className="rounded-full bg-[color:var(--brand-cream)] px-3 py-1 text-xs font-medium"
                >
                  {c.label} ×
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-[color:var(--brand-magenta)]"
                onClick={() => router.push(pathname)}
              >
                Clear all
              </button>
            </div>
          )}

          {query.isLoading && <ProductGridSkeleton />}
          {query.isError && (
            <p className="rounded-[--radius] border border-[color:var(--danger)]/30 bg-red-50 px-4 py-6 text-sm">
              Could not load the catalog. Please refresh and try again.
            </p>
          )}
          {query.data && <ProductGrid products={query.data.items} />}

          {query.data && query.data.pages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: query.data.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(sp.toString());
                    next.set("page", String(p));
                    router.push(`${pathname}?${next.toString()}`);
                  }}
                  className={cn(
                    "h-10 min-w-10 rounded-[--radius] px-3 text-sm",
                    p === page
                      ? "bg-[color:var(--brand-green)] text-white"
                      : "border border-[color:var(--border)] bg-surface",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-semibold text-[color:var(--brand-ink)]">{label}</p>
      <div className="max-h-56 space-y-0.5 overflow-auto">{children}</div>
    </div>
  );
}

function FilterLink({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full rounded px-2 py-1 text-left hover:bg-[color:var(--brand-cream)]",
        active && "bg-[color:var(--brand-cream)] font-semibold",
      )}
    >
      {label}
    </button>
  );
}

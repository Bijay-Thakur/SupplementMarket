"use client";

import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";
import { BrandCard } from "@/components/catalog/brand-card";
import { SampleCatalogNotice } from "@/components/catalog/sample-catalog-notice";

export function BrandsDirectory() {
  const q = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  return (
    <Container className="py-12">
      <div className="rounded-[--radius-xl] bg-gradient-to-br from-[color:var(--brand-cream)] to-white px-6 py-9 text-center sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-green-strong)]">Our shelves, your favorites</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Brands we are proud to carry</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
          Explore trusted names across vitamins, herbs, family wellness and more. Select a logo to browse the brand&apos;s full collection.
        </p>
      </div>
      <SampleCatalogNotice />
      {q.isLoading && <p className="mt-8">Loading…</p>}
      {q.data && (
        <ul className="brand-directory-grid mt-8 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {q.data.map((b) => (
            <li key={b.id}>
              <BrandCard brand={b} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

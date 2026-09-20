"use client";

import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";
import { BrandCard } from "@/components/catalog/brand-card";
import { SampleCatalogNotice } from "@/components/catalog/sample-catalog-notice";

export default function BrandsPage() {
  const q = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Brands</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Shop by brand at Bronxville Natural Market.
      </p>
      <SampleCatalogNotice />
      {q.isLoading && <p className="mt-8">Loading…</p>}
      {q.data && (
        <ul className="brand-directory-grid mt-8 grid min-w-0 grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

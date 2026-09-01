"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listBrands } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";

export default function BrandsPage() {
  const q = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Brands</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Demonstration catalog of official manufacturer products — not the
        store&apos;s verified shelf inventory.
      </p>
      {q.isLoading && <p className="mt-8">Loading…</p>}
      {q.data && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brands/${b.slug}`}
                className="block rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5 hover:border-[color:var(--brand-green)]"
              >
                <span className="font-display text-lg font-semibold">{b.name}</span>
                {b.is_featured && (
                  <span className="ml-2 text-xs uppercase text-[color:var(--brand-magenta)]">
                    Featured
                  </span>
                )}
                {b.description && (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">{b.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

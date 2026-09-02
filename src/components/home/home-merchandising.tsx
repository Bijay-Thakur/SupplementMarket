"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listBrands, listProducts } from "@/lib/api/catalog";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/product-grid";
import { Container } from "@/components/ui/container";
import { BrandCard } from "@/components/catalog/brand-card";

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <Link href={href} className="text-sm font-semibold text-[color:var(--brand-magenta)]">
          View all →
        </Link>
      </div>
      {children}
    </section>
  );
}

export function HomeMerchandising() {
  const bestsellers = useQuery({
    queryKey: ["home", "bestsellers"],
    queryFn: () => listProducts({ bestseller: true, page_size: 4, sort: "relevance" }),
  });
  const multis = useQuery({
    queryKey: ["home", "multi"],
    queryFn: () => listProducts({ category: "multivitamins", page_size: 4 }),
  });
  const sales = useQuery({
    queryKey: ["home", "sale"],
    queryFn: () => listProducts({ on_sale: true, page_size: 4, sort: "discount" }),
  });
  const news = useQuery({
    queryKey: ["home", "new"],
    queryFn: () => listProducts({ is_new: true, page_size: 4, sort: "newest" }),
  });
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  return (
    <Container className="space-y-14 py-4">
      {show(bestsellers) && (
        <Section title="Best sellers" href="/products?bestseller=1">
          {bestsellers.isLoading ? (
            <ProductGridSkeleton />
          ) : (
            <ProductGrid products={bestsellers.data?.items ?? []} />
          )}
        </Section>
      )}
      {show(multis) && (
        <Section title="Multivitamins" href="/categories/multivitamins">
          {multis.isLoading ? <ProductGridSkeleton /> : <ProductGrid products={multis.data?.items ?? []} />}
        </Section>
      )}
      {show(sales) && (
        <Section title="On sale now" href="/sales">
          {sales.isLoading ? <ProductGridSkeleton /> : <ProductGrid products={sales.data?.items ?? []} />}
        </Section>
      )}
      {show(news) && (
        <Section title="New arrivals" href="/new">
          {news.isLoading ? <ProductGridSkeleton /> : <ProductGrid products={news.data?.items ?? []} />}
        </Section>
      )}
      <Section title="Shop by brand" href="/brands">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(brands.data ?? []).slice(0, 8).map((b) => (
            <BrandCard key={b.id} brand={b} className="h-36" />
          ))}
        </div>
      </Section>
    </Container>
  );
}

function show(q: { isLoading: boolean; data?: { items: unknown[] } }) {
  return q.isLoading || (q.data?.items.length ?? 0) > 0;
}

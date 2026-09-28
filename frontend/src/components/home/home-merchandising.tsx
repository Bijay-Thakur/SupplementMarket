"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listBrands, listProducts } from "@/lib/api/catalog";
import { ProductGrid, ProductGridSkeleton } from "@/components/catalog/product-grid";
import { Container } from "@/components/ui/container";
import { BrandCard } from "@/components/catalog/brand-card";

function Section({
  title,
  eyebrow,
  copy,
  href,
  children,
}: {
  title: string;
  eyebrow?: string;
  copy?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-5">
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-green-strong)]">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
          {copy && <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">{copy}</p>}
        </div>
        <Link href={href} className="shrink-0 text-sm font-semibold text-[color:var(--brand-magenta)] hover:underline">
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
    queryFn: () => listProducts({ bestseller: true, page_size: 6, sort: "relevance" }),
  });
  const multis = useQuery({
    queryKey: ["home", "multi"],
    queryFn: () => listProducts({ category: "multivitamins", page_size: 6 }),
  });
  const sales = useQuery({
    queryKey: ["home", "sale"],
    queryFn: () => listProducts({ on_sale: true, page_size: 6, sort: "discount" }),
  });
  const news = useQuery({
    queryKey: ["home", "new"],
    queryFn: () => listProducts({ is_new: true, page_size: 6, sort: "newest" }),
  });
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });

  return (
    <Container className="space-y-16 py-4">
      {show(bestsellers) && (
        <Section eyebrow="Customer favorites" title="Best sellers" copy="The wellness staples our neighbors return to again and again." href="/products?bestseller=1">
          {bestsellers.isLoading ? <ProductGridSkeleton wide /> : <ProductGrid products={bestsellers.data?.items ?? []} wide />}
        </Section>
      )}
      {show(multis) && (
        <Section eyebrow="Build your foundation" title="Daily multivitamins" copy="Easy, everyday support for a wide range of wellness routines." href="/categories/multivitamins">
          {multis.isLoading ? <ProductGridSkeleton wide /> : <ProductGrid products={multis.data?.items ?? []} wide />}
        </Section>
      )}
      {show(sales) && (
        <Section eyebrow="A little extra value" title="On sale now" copy="Limited-time savings on products selected from across the store." href="/sales">
          {sales.isLoading ? <ProductGridSkeleton wide /> : <ProductGrid products={sales.data?.items ?? []} wide />}
        </Section>
      )}
      {show(news) && (
        <Section eyebrow="Fresh on the shelf" title="New arrivals" copy="Discover the latest additions to our neighborhood wellness collection." href="/new">
          {news.isLoading ? <ProductGridSkeleton wide /> : <ProductGrid products={news.data?.items ?? []} wide />}
        </Section>
      )}
      <Section eyebrow="Names you trust" title="Shop by brand" copy="Go straight to your favorites and explore their complete collection." href="/brands">
        <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {(brands.data ?? []).slice(0, 12).map((brand) => (
            <BrandCard key={brand.id} brand={brand} className="h-32" />
          ))}
        </div>
      </Section>
    </Container>
  );
}

function show(query: { isLoading: boolean; data?: { items: unknown[] } }) {
  return query.isLoading || (query.data?.items.length ?? 0) > 0;
}

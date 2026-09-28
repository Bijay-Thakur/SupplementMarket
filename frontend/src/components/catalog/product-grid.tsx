import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

const gridClass =
  "grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

export function ProductGrid({ products, wide = false }: { products: ProductListItem[]; wide?: boolean }) {
  if (products.length === 0) {
    return (
      <p className="rounded-[--radius] border border-dashed border-[color:var(--border)] bg-surface px-4 py-12 text-center text-[color:var(--muted)]">
        No products match these filters. Try clearing a filter or searching a
        different term.
      </p>
    );
  }
  return (
    <div className={cn(gridClass, wide && "catalog-product-grid")}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} compact={wide} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn(gridClass, wide && "catalog-product-grid")}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-[23rem] animate-pulse rounded-[--radius-lg] border border-[color:var(--border)] bg-white/70"
        />
      ))}
    </div>
  );
}

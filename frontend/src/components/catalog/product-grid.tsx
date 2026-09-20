import { ProductCard } from "./product-card";
import type { ProductListItem } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

const gridClass = "grid min-w-0 grid-cols-1 gap-3 min-[380px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

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
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn(gridClass, wide && "catalog-product-grid")}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[3/4] animate-pulse rounded-[--radius-lg] border border-[color:var(--border)] bg-white/70"
        />
      ))}
    </div>
  );
}

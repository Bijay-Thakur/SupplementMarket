"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AvailabilityBadge } from "./availability-badge";
import { PriceDisplay } from "./price-display";
import { ProductThumb } from "./product-thumb";
import { buttonVariants } from "@/components/ui/button";
import { canAddToCart } from "@/lib/catalog-copy";
import { useCart } from "@/components/cart/cart-provider";
import type { ProductListItem } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

export function ProductCard({ product }: { product: ProductListItem }) {
  const cart = useCart();
  const purchasable = canAddToCart(product.availability);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[--radius-lg] border border-[color:var(--border)] bg-surface shadow-[var(--shadow-card)]">
      <Link href={`/products/${product.slug}`} className="block">
        <ProductThumb
          src={product.primary_image_url}
          alt={product.name}
          className="aspect-square w-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand-green-strong)]">
          {product.brand_name}
        </p>
        <Link href={`/products/${product.slug}`} className="font-medium leading-snug hover:underline">
          {product.name}
        </Link>
        <p className="text-xs text-[color:var(--muted)]">
          {[product.form, product.strength_value && `${product.strength_value} ${product.strength_unit ?? ""}`, product.count && `${product.count} ct`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <AvailabilityBadge value={product.availability} />
          {product.on_sale && <Badge variant="sale">Sale</Badge>}
          {product.is_new && <Badge variant="new">New</Badge>}
        </div>
        <PriceDisplay
          regularCents={product.regular_price_cents}
          saleCents={product.sale_price_cents}
        />
        {purchasable ? (
          <button
            type="button"
            className={cn(buttonVariants({ size: "sm" }), "mt-1 w-full")}
            onClick={() =>
              cart.add({
                productId: product.id,
                slug: product.slug,
                name: product.name,
                brandName: product.brand_name,
                unitPriceCents: product.effective_price_cents,
                availability: product.availability,
                imageUrl: product.primary_image_url,
              })
            }
          >
            Add to cart
          </button>
        ) : (
          <Link
            href={`/products/${product.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1 w-full")}
          >
            View details
          </Link>
        )}
      </div>
    </article>
  );
}

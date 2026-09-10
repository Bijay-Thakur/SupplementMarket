"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProduct } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { PriceDisplay } from "@/components/catalog/price-display";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-provider";
import { canAddToCart } from "@/lib/catalog-copy";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug),
    enabled: Boolean(slug),
  });

  if (product.isLoading) {
    return (
      <Container className="py-16">
        <div className="h-96 animate-pulse rounded-[--radius-lg] bg-white/70" />
      </Container>
    );
  }

  if (product.isError || !product.data) {
    return (
      <Container className="py-16">
        <p>We couldn&apos;t find that product.</p>
      </Container>
    );
  }

  const p = product.data;
  const purchasable = canAddToCart(p.availability);

  return (
    <Container className="py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        <ProductThumb
          src={p.images[0]?.url ?? p.primary_image_url}
          alt={p.images[0]?.alt_text || p.name}
          className="aspect-square w-full rounded-[--radius-xl] object-cover"
        />

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-green-strong)]">
            {p.brand_name}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold">{p.name}</h1>

          <div className="mt-5 flex flex-wrap gap-2">
            <AvailabilityBadge value={p.availability} />
            {p.on_sale && <Badge variant="sale">Sale {p.discount_percent}% off</Badge>}
          </div>

          <PriceDisplay
            className="mt-6"
            regularCents={p.regular_price_cents}
            saleCents={p.sale_price_cents}
            showLabels
          />

          {p.upc ? (
            <p className="mt-4 text-sm text-[color:var(--muted)]">
              <span className="font-medium text-[color:var(--brand-ink)]">UPC</span>{" "}
              <span className="font-mono">{p.upc}</span>
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-3" aria-label="Delivery order options">
            <label className="text-sm font-medium text-[color:var(--brand-ink)]">
              <span className="block">Quantity</span>
              <input
                type="number"
                min={1}
                max={99}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="mt-1 h-12 w-24 rounded-[--radius] border border-[color:var(--border)] px-3"
              />
            </label>
            <button
              type="button"
              disabled={!purchasable}
              className={buttonVariants({ size: "lg" })}
              onClick={() =>
                cart.add(
                  {
                    productId: p.id,
                    slug: p.slug,
                    name: p.name,
                    brandName: p.brand_name,
                    unitPriceCents: p.effective_price_cents,
                    availability: p.availability,
                    imageUrl: p.primary_image_url,
                  },
                  qty,
                )
              }
            >
              {purchasable ? "Add to cart" : "Currently unavailable"}
            </button>
          </div>
        </div>
      </div>
    </Container>
  );
}

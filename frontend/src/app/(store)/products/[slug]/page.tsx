"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Barcode, LoaderCircle } from "lucide-react";
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
      <Container className="max-w-7xl py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)] lg:gap-14">
          <div className="aspect-square animate-pulse rounded-[--radius-xl] border border-[color:var(--border)] bg-white/70" />
          <div className="flex min-h-80 items-center justify-center rounded-[--radius-xl] border border-[color:var(--border)] bg-white/55">
            <div role="status" className="flex items-center gap-3 text-sm font-medium text-[color:var(--muted)]">
              <LoaderCircle className="h-7 w-7 animate-spin text-[color:var(--brand-magenta)]" aria-hidden="true" />
              Loading product details...
            </div>
          </div>
        </div>
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
    <Container className="max-w-7xl py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-[minmax(22rem,30rem)_minmax(0,1fr)] lg:items-start lg:gap-14 xl:gap-16">
        <div className="mx-auto w-full max-w-[30rem] rounded-[--radius-xl] border border-[color:var(--border)] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7 lg:mx-0">
          <ProductThumb
            src={p.images[0]?.url ?? p.primary_image_url}
            alt={p.images[0]?.alt_text || p.name}
            className="aspect-square w-full rounded-[--radius-lg] object-contain"
          />
        </div>

        <div className="max-w-2xl lg:pt-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-green-strong)]">
            {p.brand_name}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-4xl">{p.name}</h1>

          {p.short_description ? (
            <p className="mt-4 max-w-xl text-base leading-7 text-[color:var(--muted)]">
              {p.short_description}
            </p>
          ) : null}

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
            <div className="mt-5 inline-flex items-center gap-3 rounded-[--radius] border border-[color:var(--border)] bg-white px-4 py-3 shadow-sm">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[color:var(--brand-cream)] text-[color:var(--brand-green-strong)]">
                <Barcode className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  UPC
                </span>
                <span className="block font-mono text-sm font-medium tracking-[0.08em] text-[color:var(--brand-ink)] tabular-nums">
                  {p.upc}
                </span>
              </span>
            </div>
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

          {p.long_description || p.ingredient_highlights || p.usage_text || p.warnings ? (
            <div className="mt-8 border-t border-[color:var(--border)] pt-7">
              {p.long_description ? (
                <ProductCopy title="About this product" text={p.long_description} />
              ) : null}
              {p.ingredient_highlights ? (
                <ProductCopy title="Ingredient highlights" text={p.ingredient_highlights} />
              ) : null}
              {p.usage_text ? <ProductCopy title="Suggested use" text={p.usage_text} /> : null}
              {p.warnings ? <ProductCopy title="Important information" text={p.warnings} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}

function ProductCopy({ title, text }: { title: string; text: string }) {
  return (
    <section className="mb-6 last:mb-0">
      <h2 className="font-display text-xl font-semibold text-[color:var(--brand-ink)]">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[color:var(--muted)]">{text}</p>
    </section>
  );
}

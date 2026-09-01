"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getProduct, relatedProducts } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";
import { AvailabilityBadge } from "@/components/catalog/availability-badge";
import { PriceDisplay } from "@/components/catalog/price-display";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { ProductGrid } from "@/components/catalog/product-grid";
import { FdaDisclaimer } from "@/components/catalog/fda-disclaimer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PhoneCta } from "@/components/layout/phone-cta";
import { useCart } from "@/components/cart/cart-provider";
import { canAddToCart, DIETARY_LABELS } from "@/lib/catalog-copy";
import { mediaUrl } from "@/lib/api/client";
import { useState } from "react";

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug),
    enabled: Boolean(slug),
  });
  const related = useQuery({
    queryKey: ["related", slug],
    queryFn: () => relatedProducts(slug),
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
        <Link href="/products" className="mt-4 inline-block text-[color:var(--brand-magenta)]">
          Back to catalog
        </Link>
      </Container>
    );
  }

  const p = product.data;
  const purchasable = canAddToCart(p.availability);
  const dietaryOn = Object.entries(p.dietary).filter(([, v]) => v);

  return (
    <Container className="py-10">
      <p className="text-sm text-[color:var(--muted)]">
        <Link href="/products" className="hover:underline">
          Products
        </Link>{" "}
        /{" "}
        <Link href={`/categories/${p.category_slug}`} className="hover:underline">
          {p.category_name}
        </Link>
      </p>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <ProductThumb
            src={p.images[0]?.url ?? p.primary_image_url}
            alt={p.images[0]?.alt_text || p.name}
            className="aspect-square w-full rounded-[--radius-xl] object-cover"
          />
          {p.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {p.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img.id}
                  src={mediaUrl(img.url) ?? ""}
                  alt={img.alt_text || ""}
                  className="h-16 w-16 rounded object-cover"
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <Link
            href={`/brands/${p.brand_slug}`}
            className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-green-strong)]"
          >
            {p.brand_name}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-semibold">{p.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <AvailabilityBadge value={p.availability} />
            {p.on_sale && <Badge variant="sale">Sale {p.discount_percent}% off</Badge>}
            {p.is_demo && <Badge variant="neutral">Demo data</Badge>}
          </div>
          <PriceDisplay
            className="mt-4 text-2xl"
            regularCents={p.regular_price_cents}
            saleCents={p.sale_price_cents}
          />
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            {[p.form, p.strength_value && `${p.strength_value} ${p.strength_unit ?? ""}`, p.count && `${p.count} count`, p.size]
              .filter(Boolean)
              .join(" · ")}
            {p.sku ? ` · SKU ${p.sku}` : ""}
          </p>
          {p.short_description && <p className="mt-4 text-[color:var(--muted)]">{p.short_description}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Qty{" "}
              <input
                type="number"
                min={1}
                max={99}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
                className="ml-2 h-11 w-20 rounded-[--radius] border border-[color:var(--border)] px-2"
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
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            Eligible for store pickup. Local delivery is available in configured ZIP
            codes and confirmed by the store.
          </p>
          <div className="mt-3">
            <PhoneCta />
          </div>
        </div>
      </div>

      <section className="mt-12 max-w-3xl space-y-4 text-sm text-[color:var(--muted)]">
        {p.long_description && (
          <div>
            <h2 className="font-display text-xl font-semibold text-[color:var(--brand-ink)]">
              About this product
            </h2>
            <p className="mt-2">{p.long_description}</p>
          </div>
        )}
        {p.ingredient_highlights && (
          <p>
            <strong>Ingredient highlights: </strong>
            {p.ingredient_highlights}
          </p>
        )}
        {p.usage_text && (
          <p>
            <strong>Directions: </strong>
            {p.usage_text}
          </p>
        )}
        {dietaryOn.length > 0 && (
          <p>
            <strong>Dietary: </strong>
            {dietaryOn.map(([k]) => DIETARY_LABELS[k] ?? k).join(", ")}
          </p>
        )}
        {p.wellness_tags.length > 0 && (
          <p>
            Commonly categorized for {p.wellness_tags.join(", ")}. This is a catalog
            grouping, not a medical claim.
          </p>
        )}
        <FdaDisclaimer />
        {p.warnings && <p>{p.warnings}</p>}
      </section>

      {related.data && related.data.items.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 font-display text-2xl font-semibold">Related products</h2>
          <ProductGrid products={related.data.items} />
        </section>
      )}
    </Container>
  );
}

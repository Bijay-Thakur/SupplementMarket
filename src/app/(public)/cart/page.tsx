"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-provider";
import { Container } from "@/components/ui/container";
import { PriceDisplay } from "@/components/catalog/price-display";
import { ProductThumb } from "@/components/catalog/product-thumb";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

export default function CartPage() {
  const { items, setQty, remove, subtotalCents } = useCart();

  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Your cart</h1>
      {items.length === 0 ? (
        <p className="mt-6 text-[color:var(--muted)]">
          Your cart is empty.{" "}
          <Link href="/products" className="text-[color:var(--brand-magenta)]">
            Shop the catalog
          </Link>
        </p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px]">
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={item.productId}
                className="flex gap-4 rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-4"
              >
                <ProductThumb
                  src={item.imageUrl}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.slug}`} className="font-medium hover:underline">
                    {item.name}
                  </Link>
                  <p className="text-xs text-[color:var(--muted)]">{item.brandName}</p>
                  <PriceDisplay regularCents={item.unitPriceCents} saleCents={null} />
                  <div className="mt-2 flex items-center gap-3">
                    <label className="text-sm">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={item.quantity}
                        onChange={(e) => setQty(item.productId, Number(e.target.value))}
                        className="ml-2 h-9 w-16 rounded border border-[color:var(--border)] px-2"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-sm text-[color:var(--danger)]"
                      onClick={() => remove(item.productId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5">
            <p className="flex justify-between font-semibold">
              <span>Subtotal</span>
              <span>{formatCents(subtotalCents)}</span>
            </p>
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Prices shown from your cart snapshot. Final totals are calculated on
              the server at checkout.
            </p>
            <Link href="/checkout" className={`${buttonVariants()} mt-4 w-full`}>
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </Container>
  );
}

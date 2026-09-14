"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getOrder, getStoreSettings } from "@/lib/api/catalog";
import { Container } from "@/components/ui/container";
import { formatCents } from "@/lib/money";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders/status";

export default function OrderConfirmationPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const q = useQuery({
    queryKey: ["order", publicToken],
    queryFn: () => getOrder(publicToken),
    enabled: Boolean(publicToken),
    refetchInterval: 10_000,
  });
  const settings = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  const storePhone = settings.data?.phone || "+1 (914) 779-3552";
  const phoneHref = `tel:${storePhone.replace(/[^+\d]/g, "")}`;

  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Order request received</h1>
      {q.isLoading && <p className="mt-4">Loading status…</p>}
      {q.isError && (
        <p className="mt-4 text-[color:var(--danger)]">
          We couldn&apos;t find that order. Check the link or contact the store.
        </p>
      )}
      {q.data && (
        <div className="mt-6 max-w-lg rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-6">
          <p className="text-sm text-[color:var(--muted)]">Reference</p>
          <p className="font-display text-2xl font-semibold">{q.data.order_number}</p>
          <div className="mt-4 rounded-[--radius] border border-[color:var(--border)] bg-[color:var(--brand-cream)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Current status</p>
            <p className="mt-1 text-lg font-semibold">{orderStatusLabel(q.data.status)}</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {paymentStatusLabel(q.data.payment_status)} · {q.data.fulfillment_type}
            </p>
          </div>
          <ul className="mt-4 space-y-1 text-sm">
            {q.data.items.map((i) => (
              <li key={i.sku ?? i.product_name} className="flex justify-between">
                <span>
                  {i.product_name} × {i.quantity}
                </span>
                <span>{formatCents(i.line_total_cents)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCents(q.data.total_cents)}</span>
          </p>
          <p className="mt-4 text-sm text-[color:var(--muted)]">
            No online payment was taken. Call the store to confirm your order and arrange {q.data.fulfillment_type}.
          </p>
          <a href={phoneHref} className={`${buttonVariants()} mt-5`}>
            Call {storePhone}
          </a>
        </div>
      )}
      <Link href="/products" className="mt-8 inline-block text-[color:var(--brand-magenta)]">
        Continue shopping
      </Link>
    </Container>
  );
}

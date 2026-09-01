"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getOrder } from "@/lib/api/catalog";
import type { OrderPublic } from "@/lib/api/types";
import { Container } from "@/components/ui/container";
import { formatCents } from "@/lib/money";
import Link from "next/link";

export default function OrderConfirmationPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const q = useQuery({
    queryKey: ["order", publicToken],
    queryFn: async () => {
      try {
        return await getOrder(publicToken);
      } catch {
        const raw = sessionStorage.getItem(`bnm-order:${publicToken}`);
        if (raw) return JSON.parse(raw) as OrderPublic;
        throw new Error("Order not found");
      }
    },
    enabled: Boolean(publicToken),
  });

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
          <p className="mt-2 text-sm">
            Status: {q.data.status.replaceAll("_", " ")} · {q.data.fulfillment_type}
          </p>
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
            This is a demonstration order request. Online card payment is not enabled
            yet. The store will confirm pickup or delivery separately.
          </p>
        </div>
      )}
      <Link href="/products" className="mt-8 inline-block text-[color:var(--brand-magenta)]">
        Continue shopping
      </Link>
    </Container>
  );
}

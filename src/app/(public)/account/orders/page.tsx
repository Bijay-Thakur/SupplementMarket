"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import type { OrderPublic } from "@/lib/api/types";
import { formatCents } from "@/lib/money";

export default function AccountOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderPublic[] | null>(null);

  useEffect(() => {
    fetch("/api/v1/account/orders", { credentials: "include" }).then(async (r) => {
      if (r.status === 401) {
        router.push("/auth/sign-in?next=/account/orders");
        return;
      }
      const data = await r.json();
      setOrders(data.items ?? []);
    });
  }, [router]);

  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Your orders</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      {orders === null && <p className="mt-6">Loading…</p>}
      {orders && orders.length === 0 && <p className="mt-6 text-sm text-[color:var(--muted)]">No orders yet.</p>}
      {orders && orders.length > 0 && (
        <ul className="mt-6 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
          {orders.map((o) => (
            <li key={o.public_token} className="px-4 py-3 text-sm">
              <Link href={`/order/confirmation/${o.public_token}`} className="font-semibold underline">
                {o.order_number}
              </Link>
              <p className="text-[color:var(--muted)]">
                {o.status} · {o.fulfillment_type} · {o.payment_status ?? "unpaid"} · {formatCents(o.total_cents)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}

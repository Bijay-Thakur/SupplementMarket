"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/lib/auth/types";
import type { CustomerAddress } from "@/lib/auth/types";
import type { OrderPublic } from "@/lib/api/types";

export default function AccountDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [orders, setOrders] = useState<OrderPublic[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/account/profile", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/v1/account/orders", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([auth, profile, orderData]) => {
        if (!auth.user) {
          router.push("/auth/sign-in?next=/account");
          return;
        }
        setUser((profile.user ?? auth.user) as AuthUser);
        setAddresses((profile.addresses ?? []) as CustomerAddress[]);
        setOrders((orderData.items ?? []) as OrderPublic[]);
      })
      .catch(() => setError("Could not load your account."));
  }, [router]);

  if (error) {
    return (
      <Container className="py-12">
        <p className="text-[color:var(--danger)]">{error}</p>
      </Container>
    );
  }
  if (!user) {
    return (
      <Container className="py-12">
        <p>Loading account…</p>
      </Container>
    );
  }

  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Your account</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-6">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[color:var(--brand-cream)] font-display text-2xl">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (user.displayName || user.username).slice(0, 1).toUpperCase()
            )}
          </div>
          <p className="mt-3 font-semibold">{user.displayName || user.username}</p>
          <p className="text-sm text-[color:var(--muted)]">@{user.username}</p>
        </div>
        <div className="space-y-4 text-sm">
          <p>
            <strong>Email:</strong> {user.email} {user.emailVerified ? "(verified)" : "(unverified)"}
          </p>
          <p>
            <strong>Phone:</strong> {user.phone || "Not added"}
          </p>
          <p>
            <strong>Profile:</strong> {user.profileCompleted ? "Complete" : "Needs completion"}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/account/profile" className={buttonVariants({ size: "sm" })}>
              Edit profile
            </Link>
            <Link href="/account/addresses" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Addresses
            </Link>
            <Link href="/auth/reset-password" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Change password
            </Link>
            <button
              type="button"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              onClick={async () => {
                await fetch("/api/auth?action=sign-out", { method: "POST", credentials: "include" });
                router.push("/");
                router.refresh();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Saved addresses</h2>
          <Link href="/account/addresses" className="text-sm text-[color:var(--brand-magenta)]">
            Manage
          </Link>
        </div>
        {addresses.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">No saved addresses yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {addresses.map((a) => (
              <li key={a.id}>
                {a.label || "Address"} — {a.addressLine1}, {a.city} {a.isDefault ? "(default)" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-semibold">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-[color:var(--brand-magenta)]">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
            {orders.slice(0, 5).map((o) => (
              <li key={o.public_token} className="flex justify-between px-4 py-3 text-sm">
                <Link href={`/order/confirmation/${o.public_token}`} className="font-medium underline">
                  {o.order_number}
                </Link>
                <span>
                  {o.status} · {o.fulfillment_type} · {o.payment_status ?? "unpaid"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/components/cart/cart-provider";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { createOrder, getStoreSettings } from "@/lib/api/catalog";
import { ApiRequestError } from "@/lib/api/client";
import type { OrderPublic } from "@/lib/api/types";
import type { AuthUser } from "@/lib/auth/types";
import { ActivityOverlay } from "@/components/ui/activity-overlay";

export function CheckoutForm({ user }: { user: AuthUser }) {
  const { items, subtotalCents, clear } = useCart();
  const settings = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<OrderPublic | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const [form, setForm] = useState({
    customer_name: user.displayName || user.fullName,
    customer_email: user.email,
    customer_phone: user.phone || "",
    address_line1: "",
    address_city: "",
    address_state: "NY",
    address_zip: "",
    delivery_instructions: "",
  });

  const storePhone = settings.data?.phone || "+1 (914) 779-3552";
  const phoneHref = `tel:${storePhone.replace(/[^+\d]/g, "")}`;

  if (submittedOrder) {
    return (
      <>
        <Container className="py-12">
          <h1 className="font-display text-3xl font-semibold">Order submitted</h1>
          <p className="mt-3 text-[color:var(--muted)]">
            Your reference is {submittedOrder.order_number}.
          </p>
        </Container>
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-call-title"
            aria-describedby="order-call-description"
            className="w-full max-w-md rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-6 shadow-2xl"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--brand-green)]">
              Order request received
            </p>
            <h2 id="order-call-title" className="mt-2 font-display text-2xl font-semibold">
              Please call the store
            </h2>
            <p id="order-call-description" className="mt-3 text-sm text-[color:var(--muted)]">
              No online payment was taken. Call us to confirm {submittedOrder.fulfillment_type}
              {submittedOrder.fulfillment_type === "delivery"
                ? " and any delivery fee"
                : " and pickup timing"}.
            </p>
            <p className="mt-3 text-sm">
              Reference: <strong>{submittedOrder.order_number}</strong>
            </p>
            <p className="mt-2 text-sm">
              Status: <strong>Order sent</strong>
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={phoneHref} className={buttonVariants({ size: "lg" })}>
                Call {storePhone}
              </a>
              <Link
                href={`/order/confirmation/${submittedOrder.public_token}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View order
              </Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <Container className="py-12">
        <h1 className="font-display text-3xl font-semibold">Checkout</h1>
        <p className="mt-4 text-[color:var(--muted)]">Your cart is empty.</p>
      </Container>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
      const order = await createOrder({
        idempotency_key: idempotencyKey.current,
        fulfillment_type: fulfillment,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        delivery_address_line1: fulfillment === "delivery" ? form.address_line1 : "",
        delivery_city: fulfillment === "delivery" ? form.address_city : "",
        delivery_state: fulfillment === "delivery" ? form.address_state : "",
        delivery_zip: fulfillment === "delivery" ? form.address_zip : "",
        delivery_instructions:
          fulfillment === "delivery" ? form.delivery_instructions || null : null,
      });
      try {
        sessionStorage.setItem(`bnm-order:${order.public_token}`, JSON.stringify(order));
      } catch {
        /* private browsing */
      }
      if (fulfillment === "delivery" && saveAddress) {
        void fetch("/api/v1/account/addresses", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: "Checkout",
            recipientName: form.customer_name,
            phone: form.customer_phone,
            addressLine1: form.address_line1,
            city: form.address_city,
            state: form.address_state,
            postalCode: form.address_zip,
            deliveryInstructions: form.delivery_instructions,
            isDefault: false,
          }),
        }).catch(() => undefined);
      }
      clear();
      idempotencyKey.current = null;
      setSubmittedOrder(order);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not submit the order request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-12">
      <ActivityOverlay visible={pending} label="Submitting your order…" />
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>
      <p className="mt-2 max-w-2xl rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm">
        Submit your order request here, then call the store to confirm it. No online payment or card information is collected.
      </p>

      <form onSubmit={onSubmit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="font-semibold">Fulfillment</legend>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "pickup"}
                  onChange={() => {
                    setFulfillment("pickup");
                    setSaveAddress(false);
                  }}
                />
                Store pickup
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "delivery"}
                  onChange={() => setFulfillment("delivery")}
                />
                Local delivery
              </label>
            </div>
            {fulfillment === "delivery" && (
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Delivery eligibility and fees are confirmed by the store after submission.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="font-semibold">How payment works</legend>
            <p className="text-sm text-[color:var(--muted)]">
              The store will confirm your order by phone. Payment is arranged directly with the store.
            </p>
          </fieldset>

          <Field label="Name" required>
            <input
              required
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
          </Field>
          <Field label="Account email">
            <input
              readOnly
              type="email"
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-[color:var(--brand-cream)] px-3"
              value={form.customer_email}
            />
          </Field>
          <Field label="Phone" required>
            <input
              required
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            />
          </Field>
          {fulfillment === "delivery" ? (
            <div className="space-y-6 rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5">
              <h2 className="font-semibold">Delivery address</h2>
              <Field label="Address" required>
               <input
                 required
                 className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                value={form.address_line1}
                onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
               />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="City" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.address_city}
                    onChange={(e) => setForm({ ...form, address_city: e.target.value })}
                  />
                </Field>
                <Field label="State" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.address_state}
                    onChange={(e) => setForm({ ...form, address_state: e.target.value })}
                  />
                </Field>
                <Field label="ZIP" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.address_zip}
                    onChange={(e) => setForm({ ...form, address_zip: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Delivery instructions">
                <textarea
                  className="mt-1 block min-h-20 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3 py-2"
                  value={form.delivery_instructions}
                  onChange={(e) => setForm({ ...form, delivery_instructions: e.target.value })}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                Save this address to my profile
              </label>
            </div>
          ) : null}
          {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
          <button type="submit" disabled={pending} className={buttonVariants({ size: "lg" })}>
            {pending ? "Submitting…" : "Submit order"}
          </button>
        </div>

        <aside className="h-fit rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5 text-sm">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.productId} className="flex justify-between gap-2">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatCents(item.unitPriceCents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-semibold">
            <span>Estimated subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
          </p>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Final item prices are checked against the database when you submit.
          </p>
        </aside>
      </form>
    </Container>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {required ? " *" : ""}
      {children}
    </label>
  );
}

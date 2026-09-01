"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/cart-provider";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { createOrder } from "@/lib/api/catalog";
import { ApiRequestError } from "@/lib/api/client";

export default function CheckoutPage() {
  const { items, subtotalCents, clear } = useCart();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    delivery_address_line1: "",
    delivery_city: "",
    delivery_state: "NY",
    delivery_zip: "",
    delivery_instructions: "",
  });

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
      const idempotency_key = crypto.randomUUID();
      const order = await createOrder({
        idempotency_key,
        fulfillment_type: fulfillment,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
        delivery_address_line1: fulfillment === "delivery" ? form.delivery_address_line1 : null,
        delivery_city: fulfillment === "delivery" ? form.delivery_city : null,
        delivery_state: fulfillment === "delivery" ? form.delivery_state : null,
        delivery_zip: fulfillment === "delivery" ? form.delivery_zip : null,
        delivery_instructions: form.delivery_instructions || null,
      });
      try {
        sessionStorage.setItem(`bnm-order:${order.public_token}`, JSON.stringify(order));
      } catch {
        /* private browsing */
      }
      clear();
      router.push(`/order/confirmation/${order.public_token}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not submit the order request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="py-12">
      <h1 className="font-display text-3xl font-semibold">Checkout</h1>
      <p className="mt-2 max-w-2xl rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-4 py-3 text-sm">
        Online card payment will be enabled in the final payment phase. This
        demonstration submits an order request only. Do not enter card numbers.
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
                  onChange={() => setFulfillment("pickup")}
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
                Delivery fees and eligibility require store confirmation. Submitting
                this form requests delivery — it does not quote a final fee.
              </p>
            )}
          </fieldset>

          <Field label="Name" required>
            <input
              required
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
          </Field>
          <Field label="Email" required>
            <input
              required
              type="email"
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
              value={form.customer_email}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
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

          {fulfillment === "delivery" && (
            <>
              <Field label="Address" required>
                <input
                  required
                  className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                  value={form.delivery_address_line1}
                  onChange={(e) =>
                    setForm({ ...form, delivery_address_line1: e.target.value })
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="City" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.delivery_city}
                    onChange={(e) => setForm({ ...form, delivery_city: e.target.value })}
                  />
                </Field>
                <Field label="State" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.delivery_state}
                    onChange={(e) => setForm({ ...form, delivery_state: e.target.value })}
                  />
                </Field>
                <Field label="ZIP" required>
                  <input
                    required
                    className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={form.delivery_zip}
                    onChange={(e) => setForm({ ...form, delivery_zip: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}
          {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
          <button type="submit" disabled={pending} className={buttonVariants({ size: "lg" })}>
            {pending ? "Submitting…" : "Submit demo order request"}
          </button>
        </div>

        <aside className="h-fit rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5 text-sm">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2">
            {items.map((i) => (
              <li key={i.productId} className="flex justify-between gap-2">
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span>{formatCents(i.unitPriceCents * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex justify-between font-semibold">
            <span>Estimated subtotal</span>
            <span>{formatCents(subtotalCents)}</span>
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

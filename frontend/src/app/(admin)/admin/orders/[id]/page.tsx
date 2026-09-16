"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  adminDeleteOrder,
  adminGetOrder,
  adminMarkOrderNotificationSeen,
  adminUpdateOrderStatus,
} from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";
import { ApiRequestError } from "@/lib/api/client";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/orders/status";
import { useEffect, useState } from "react";
import { ReceiptActions } from "@/components/orders/receipt-actions";
import { ActivityOverlay } from "@/components/ui/activity-overlay";

const PICKUP_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];
const DELIVERY_STATUSES = [
  "placed",
  "confirmed",
  "preparing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];
const PAYMENT_REQUIRED_STATUSES = new Set(["shipped", "out_for_delivery", "delivered", "completed"]);

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [allowUnpaidFulfillment, setAllowUnpaidFulfillment] = useState(false);
  const q = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => adminGetOrder(Number(id)),
    enabled: Boolean(id),
  });
  const o = q.data;

  useEffect(() => {
    if (!o?.id || o.admin_seen_at) return;
    void adminMarkOrderNotificationSeen(o.id).catch(() => undefined);
  }, [o?.admin_seen_at, o?.id]);

  if (q.isError) {
    return <p className="text-sm text-[color:var(--danger)]">This order could not be loaded.</p>;
  }
  if (!o) return <p>Loading…</p>;
  return (
    <div className="max-w-2xl">
      <ActivityOverlay visible={updating} label="Updating order…" />
      <h1 className="font-display text-3xl font-semibold">{o.order_number}</h1>
      {o.is_demo && <p className="mt-1 text-xs uppercase text-[color:var(--brand-magenta)]">Demo order</p>}
      <p className="mt-4 text-sm">
        {o.customer_name} · {o.customer_email} · <a className="underline" href={`tel:${o.customer_phone.replace(/[^+\d]/g, "")}`}>{o.customer_phone}</a>
      </p>
      <p className="text-sm">
        {o.fulfillment_type}
        {o.delivery_address_line1
          ? ` · ${o.delivery_address_line1}, ${o.delivery_city}, ${o.delivery_state} ${o.delivery_zip}`
          : ""}
      </p>
      <div className="mt-4 grid gap-4 rounded-[--radius] border border-[color:var(--border)] bg-surface p-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Order status
          <select
            className="fld mt-1"
            value={o.status}
            disabled={updating}
            onChange={async (event) => {
              setUpdating(true);
              setUpdateError(null);
              try {
                await adminUpdateOrderStatus(
                  o.id,
                  event.target.value,
                  undefined,
                  allowUnpaidFulfillment,
                );
                await q.refetch();
              } catch (error) {
                setUpdateError(
                  error instanceof ApiRequestError ? error.message : "The order status could not be updated.",
                );
              } finally {
                setUpdating(false);
              }
            }}
          >
            {(o.fulfillment_type === "delivery" ? DELIVERY_STATUSES : PICKUP_STATUSES).map((status) => {
              const requiresPayment = PAYMENT_REQUIRED_STATUSES.has(status);
              const blocked =
                requiresPayment &&
                o.payment_status !== "paid" &&
                !o.payment_requirement_bypassed &&
                !allowUnpaidFulfillment;
              return (
                <option key={status} value={status} disabled={blocked}>
                  {orderStatusLabel(status)}{blocked ? " — payment required" : ""}
                </option>
              );
            })}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Payment status
          <select
            className="fld mt-1"
            value={o.payment_status ?? "unpaid"}
            disabled={updating}
            onChange={async (event) => {
              setUpdating(true);
              setUpdateError(null);
              try {
                await adminUpdateOrderStatus(o.id, undefined, event.target.value);
                await q.refetch();
                if (event.target.value === "paid") setAllowUnpaidFulfillment(false);
              } catch (error) {
                setUpdateError(
                  error instanceof ApiRequestError ? error.message : "The payment status could not be updated.",
                );
              } finally {
                setUpdating(false);
              }
            }}
          >
            <option value="unpaid">{paymentStatusLabel("unpaid")}</option>
            <option value="paid">{paymentStatusLabel("paid")}</option>
          </select>
        </label>
        {o.payment_status !== "paid" && !o.payment_requirement_bypassed && (
          <label className="flex items-start gap-2 rounded-[--radius] border border-amber-300 bg-amber-50 p-3 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowUnpaidFulfillment}
              onChange={(event) => setAllowUnpaidFulfillment(event.target.checked)}
            />
            <span>
              <strong>Manual payment bypass:</strong> allow shipping, delivery, or completion before payment is recorded.
            </span>
          </label>
        )}
        {o.payment_requirement_bypassed && (
          <p className="rounded-[--radius] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2">
            Payment requirement manually bypassed
            {o.payment_bypassed_at ? ` on ${new Date(o.payment_bypassed_at).toLocaleString()}` : ""}.
          </p>
        )}
      </div>
      {o.delivery_instructions && (
        <p className="mt-2 text-sm">
          <strong>Delivery instructions:</strong> {o.delivery_instructions}
        </p>
      )}
      {updating && <p className="mt-2 text-sm text-[color:var(--muted)]">Updating status…</p>}
      {updateError && <p className="mt-2 text-sm text-[color:var(--danger)]">{updateError}</p>}
      <ul className="mt-6 space-y-2 text-sm">
        {o.items.map((i) => (
          <li key={i.sku ?? i.product_name} className="flex justify-between">
            <span>
              {i.product_name} × {i.quantity}
            </span>
            <span>{formatCents(i.line_total_cents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex justify-between font-semibold">
        <span>Total (server-calculated)</span>
        <span>{formatCents(o.total_cents)}</span>
      </p>
      {o.payment_status === "paid" && (
        <section className="mt-6 rounded-[--radius] border border-green-200 bg-green-50 p-4">
          <h2 className="font-semibold text-green-950">Payment receipt</h2>
          <p className="mt-1 text-sm text-green-800">
            Payment was recorded{o.paid_at ? ` on ${new Date(o.paid_at).toLocaleString()}` : ""}.
          </p>
          <ReceiptActions order={o} />
        </section>
      )}
      <section className="mt-8 border-t border-red-200 pt-6">
        <h2 className="font-semibold text-red-900">Delete order</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          This permanently removes the order and its item records. This cannot be undone.
        </p>
        {!deleteOpen ? (
          <button
            type="button"
            className="mt-3 rounded-[--radius] border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}
          >
            Delete order
          </button>
        ) : (
          <div className="mt-3 max-w-md rounded-[--radius] border border-red-200 bg-red-50 p-4">
            <label className="block text-sm font-medium text-red-950">
              Type {o.order_number} to confirm
              <input
                className="fld mt-1 bg-white"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-[--radius] bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={updating || deleteConfirmation !== o.order_number}
                onClick={async () => {
                  setUpdating(true);
                  setUpdateError(null);
                  try {
                    await adminDeleteOrder(o.id, deleteConfirmation);
                    router.replace("/admin/orders");
                  } catch (error) {
                    setUpdateError(error instanceof ApiRequestError ? error.message : "The order could not be deleted.");
                    setUpdating(false);
                  }
                }}
              >
                Permanently delete
              </button>
              <button
                type="button"
                className="px-3 py-2 text-sm underline"
                onClick={() => {
                  setDeleteOpen(false);
                  setDeleteConfirmation("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

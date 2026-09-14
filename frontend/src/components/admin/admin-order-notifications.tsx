"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LoaderCircle } from "lucide-react";
import {
  adminMarkOrderNotificationSeen,
  adminOrderNotifications,
} from "@/lib/api/catalog";
import { formatCents } from "@/lib/money";

export function AdminOrderNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const previousIds = useRef<Set<number> | null>(null);
  const query = useQuery({
    queryKey: ["admin-order-notifications"],
    queryFn: adminOrderNotifications,
    refetchInterval: 5_000,
    retry: false,
  });

  useEffect(() => {
    if (!query.data) return;
    const currentIds = new Set(query.data.items.map((item) => item.id));
    if (previousIds.current) {
      const newest = query.data.items.find((item) => !previousIds.current?.has(item.id));
      if (newest) {
        setToast(`New order ${newest.order_number} from ${newest.customer_name}`);
        const timer = window.setTimeout(() => setToast(null), 8_000);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(`New order ${newest.order_number}`, {
              body: `${newest.customer_name} · ${formatCents(newest.total_cents)}`,
            });
          } catch {
            // The durable in-app badge/toast still works when an OS blocks a
            // native notification despite the browser permission state.
          }
        }
        previousIds.current = currentIds;
        return () => window.clearTimeout(timer);
      }
    }
    previousIds.current = currentIds;
  }, [query.data]);

  async function enableBrowserAlerts() {
    if (typeof Notification === "undefined") return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
    } catch {
      setPermission("unsupported");
    }
  }

  async function viewOrder(id: number) {
    try {
      await adminMarkOrderNotificationSeen(id);
      await queryClient.invalidateQueries({ queryKey: ["admin-order-notifications"] });
    } finally {
      setOpen(false);
      router.push(`/admin/orders/${id}`);
    }
  }

  const items = query.data?.items ?? [];
  return (
    <div className="relative ml-auto w-fit">
      <button
        type="button"
        aria-label={`Order notifications${items.length ? `, ${items.length} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-11 items-center gap-2 rounded-[--radius] border border-[color:var(--border)] bg-surface px-3 text-sm font-medium hover:bg-[color:var(--brand-cream)]"
      >
        {query.isFetching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Orders
        {items.length ? (
          <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[color:var(--brand-magenta)] px-1 text-xs text-white">
            {items.length > 99 ? "99+" : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-3 shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">New orders</h2>
            {permission === "default" ? (
              <button
                type="button"
                className="text-xs text-[color:var(--brand-magenta)] underline"
                onClick={enableBrowserAlerts}
              >
                Enable browser alerts
              </button>
            ) : null}
          </div>
          {query.isError ? (
            <p className="mt-3 text-sm text-[color:var(--danger)]">Notifications are temporarily unavailable.</p>
          ) : items.length ? (
            <ul className="mt-2 max-h-80 space-y-2 overflow-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void viewOrder(item.id)}
                    className="w-full rounded-[--radius] border border-[color:var(--border)] p-3 text-left hover:bg-[color:var(--brand-cream)]"
                  >
                    <span className="block font-medium">{item.order_number}</span>
                    <span className="mt-1 block text-xs text-[color:var(--muted)]">
                      {item.customer_name} · {item.fulfillment_type} · {formatCents(item.total_cents)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--muted)]">No unread orders.</p>
          )}
        </section>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 max-w-sm rounded-[--radius] bg-[color:var(--brand-green)] px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

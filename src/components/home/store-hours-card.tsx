"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreSettings } from "@/lib/api/catalog";
import { DEFAULT_STORE_CONFIG, formatHours } from "@/lib/config/store";

export function StoreHoursCard() {
  const q = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  const note = q.data?.hours_note || formatHours();
  return (
    <div className="rounded-[--radius-xl] border border-[color:var(--border)] bg-surface p-6 text-sm text-[color:var(--muted)]">
      <p className="font-medium text-[color:var(--brand-ink)]">Store hours</p>
      <p className="mt-2">{DEFAULT_STORE_CONFIG.hours.weekdays}</p>
      <p>{DEFAULT_STORE_CONFIG.hours.sunday}</p>
      {note && note !== formatHours() && <p className="mt-2">{note}</p>}
    </div>
  );
}

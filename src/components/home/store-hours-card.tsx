"use client";

import { useQuery } from "@tanstack/react-query";
import { getStoreSettings } from "@/lib/api/catalog";

export function StoreHoursCard() {
  const q = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  return (
    <div className="rounded-[--radius-xl] border border-[color:var(--border)] bg-surface p-6 text-sm text-[color:var(--muted)]">
      <p className="font-medium text-[color:var(--brand-ink)]">Store hours</p>
      <p className="mt-2">
        {q.data?.hours_note ||
          "Visit us at 86 Pondfield Road, Bronxville, or ask the team for current hours."}
      </p>
    </div>
  );
}

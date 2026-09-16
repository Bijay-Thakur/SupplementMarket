"use client";

import { LoaderCircle } from "lucide-react";

export function ActivityOverlay({
  visible,
  label = "Working…",
}: {
  visible: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-white/65 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex min-w-48 flex-col items-center gap-3 rounded-[--radius-lg] border border-[color:var(--border)] bg-surface px-6 py-5 text-center shadow-xl">
        <LoaderCircle
          className="h-9 w-9 animate-spin text-[color:var(--brand-magenta)]"
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-[color:var(--brand-ink)]">{label}</span>
      </div>
    </div>
  );
}

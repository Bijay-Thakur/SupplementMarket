"use client";

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
      className="fixed inset-0 z-[100] grid place-items-center bg-white/55 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex min-w-48 flex-col items-center gap-3 rounded-[--radius-lg] border border-white/80 bg-surface/95 px-7 py-6 text-center shadow-[0_22px_70px_rgba(33,56,37,0.18)]">
        <span className="relative h-14 w-14" aria-hidden="true">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-[color:var(--brand-green)]/15 border-t-[color:var(--brand-magenta)]" />
          <span
            className="absolute inset-[7px] animate-spin rounded-full border-[3px] border-[color:var(--brand-magenta)]/10 border-b-[color:var(--brand-green)]"
            style={{ animationDirection: "reverse", animationDuration: "1.25s" }}
          />
          <span className="absolute inset-[21px] rounded-full bg-[color:var(--brand-gold)] shadow-[0_0_0_5px_rgba(226,160,43,0.15)]" />
        </span>
        <span className="text-sm font-semibold text-[color:var(--brand-ink)]">{label}</span>
      </div>
    </div>
  );
}

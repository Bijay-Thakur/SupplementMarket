import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils/cn";

export function PriceDisplay({
  regularCents,
  saleCents,
  className,
  showLabels = false,
}: {
  regularCents: number;
  saleCents: number | null;
  className?: string;
  showLabels?: boolean;
}) {
  const onSale = saleCents != null && saleCents < regularCents;

  if (showLabels) {
    return (
      <div className={cn("space-y-2", className)}>
        {onSale && (
          <div className="flex items-baseline gap-3">
            <span className="w-24 text-sm font-medium text-[color:var(--muted)]">Store SRP</span>
            <span className="text-2xl font-semibold text-[color:var(--brand-magenta)]">
              {formatCents(saleCents!)}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-3">
          <span className="w-24 text-sm font-medium text-[color:var(--muted)]">MSRP</span>
          <span
            className={cn(
              "font-semibold text-[color:var(--brand-ink)]",
              onSale && "text-base font-normal text-[color:var(--muted)] line-through",
            )}
          >
            {formatCents(regularCents)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <span className={cn("flex flex-wrap items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-semibold",
          onSale ? "text-[color:var(--brand-magenta)]" : "text-[color:var(--brand-ink)]",
        )}
      >
        {formatCents(onSale ? saleCents! : regularCents)}
      </span>
      {onSale && (
        <span className="text-sm text-[color:var(--muted)] line-through">
          {formatCents(regularCents)}
        </span>
      )}
    </span>
  );
}

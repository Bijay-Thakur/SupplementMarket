import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils/cn";

export function PriceDisplay({
  regularCents,
  saleCents,
  className,
}: {
  regularCents: number;
  saleCents: number | null;
  className?: string;
}) {
  const onSale = saleCents != null && saleCents < regularCents;
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

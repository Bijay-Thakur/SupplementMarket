import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-[color:var(--brand-cream)] text-[color:var(--muted)]",
        sale: "bg-[color:var(--brand-magenta)] text-white",
        success: "bg-[color:var(--success)]/10 text-[color:var(--success)]",
        low: "bg-[color:var(--brand-gold)]/20 text-[color:#8a5a00]",
        outofstock: "bg-neutral-100 text-neutral-500",
        new: "bg-[color:var(--brand-green)] text-white",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

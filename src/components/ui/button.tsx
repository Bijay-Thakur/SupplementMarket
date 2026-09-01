import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[--radius] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
  {
    variants: {
      variant: {
        primary:
          "bg-[color:var(--brand-magenta)] text-white hover:bg-[color:var(--brand-magenta-strong)]",
        secondary:
          "bg-[color:var(--brand-green)] text-white hover:bg-[color:var(--brand-green-strong)]",
        outline:
          "border border-[color:var(--border)] bg-surface text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]",
        ghost:
          "text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]",
        gold: "bg-[color:var(--brand-gold)] text-[color:var(--brand-ink)] hover:brightness-95",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

/** Accessible button with brand variants. Minimum 44px touch target at md+. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };

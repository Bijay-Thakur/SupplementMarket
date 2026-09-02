import { Phone } from "lucide-react";
import { DEFAULT_STORE_CONFIG } from "@/lib/config/store";
import { cn } from "@/lib/utils/cn";

/**
 * Click-to-call CTA. Uses the owner-verified store number when configured;
 * otherwise shows a clearly-labeled disabled state so an unverified number is
 * never presented as the store line.
 */
export function PhoneCta({ className }: { className?: string }) {
  const { contact } = DEFAULT_STORE_CONFIG;

  if (contact.phone && !contact.phoneIsPlaceholder) {
    return (
      <a
        href={`tel:${contact.phone}`}
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium text-[color:var(--brand-green-strong)] hover:text-[color:var(--brand-magenta)]",
          className,
        )}
      >
        <Phone className="h-4 w-4" aria-hidden />
        <span>{contact.phoneDisplay ?? contact.phone}</span>
      </a>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-sm text-[color:var(--muted)]",
        className,
      )}
      title="Phone number pending owner verification"
    >
      <Phone className="h-4 w-4" aria-hidden />
      <span>Phone coming soon</span>
    </span>
  );
}

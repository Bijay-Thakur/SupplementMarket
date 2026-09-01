import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

/**
 * Brand lockup: the official cropped mark (never redrawn) plus the store name
 * rendered as accessible text. The mark image carries descriptive alt text on
 * its own; when paired with the text wordmark we mark the image decorative to
 * avoid duplicate announcements.
 */
export function Logo({
  className,
  showWordmark = true,
  markSize = 44,
}: {
  className?: string;
  showWordmark?: boolean;
  markSize?: number;
}) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-3", className)}
      aria-label="Bronxville Natural Market — home"
    >
      <Image
        src="/brand/bronxville-natural-market-mark.png"
        alt={showWordmark ? "" : "Bronxville Natural Market"}
        aria-hidden={showWordmark || undefined}
        width={markSize}
        height={markSize}
        priority
        className="h-auto w-auto"
        style={{ width: markSize, height: "auto" }}
      />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-semibold tracking-tight text-[color:var(--brand-green-strong)]">
            Bronxville
          </span>
          <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[color:var(--brand-magenta)]">
            Natural Market
          </span>
        </span>
      )}
    </Link>
  );
}

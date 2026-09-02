import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { Brand } from "@/lib/api/types";

function approvedLogo(brand: Brand) {
  return Boolean(brand.logo_url) && brand.logo_use_status === "approved";
}

export function BrandCard({
  brand,
  className,
}: {
  brand: Brand;
  className?: string;
}) {
  const showLogo = Boolean(brand.logo_url);
  const pending = brand.logo_use_status !== "approved";
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className={cn(
        "flex h-40 flex-col items-center justify-center rounded-[--radius-lg] border border-[color:var(--border)] bg-[color:var(--brand-cream)] p-5 text-center hover:border-[color:var(--brand-green)]",
        className,
      )}
    >
      {showLogo ? (
        // Official logos are never recolored, stretched, or cropped.
        <span className="flex h-20 w-full items-center justify-center rounded bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.logo_url ?? ""}
            alt={brand.logo_alt || brand.name}
            className="max-h-16 max-w-full object-contain"
          />
        </span>
      ) : (
        <span className="font-display text-lg font-semibold text-[color:var(--brand-ink)]">{brand.name}</span>
      )}
      {showLogo && (
        <span className="mt-3 font-display text-sm font-semibold text-[color:var(--brand-ink)]">{brand.name}</span>
      )}
      {brand.is_featured && (
        <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-magenta)]">
          Featured
        </span>
      )}
      {showLogo && pending && (
        <span className="mt-1 text-[10px] uppercase tracking-wide text-[color:var(--muted)]">
          Logo permission pending
        </span>
      )}
    </Link>
  );
}

export { approvedLogo };

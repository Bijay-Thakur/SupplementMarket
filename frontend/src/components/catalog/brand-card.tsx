"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const showLogo = approvedLogo(brand) && failedLogo !== brand.logo_url;
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className={cn(
        "group flex h-44 flex-col items-center justify-center rounded-[--radius-lg] border border-[color:var(--border)] bg-[color:var(--brand-cream)] p-5 text-center transition hover:-translate-y-0.5 hover:border-[color:var(--brand-magenta)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-magenta)] focus-visible:ring-offset-2",
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
            onError={() => setFailedLogo(brand.logo_url ?? "")}
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
      {brand.product_count != null && (
        <span className="mt-1 text-xs text-[color:var(--muted)]">
          {brand.product_count} {brand.product_count === 1 ? "product" : "products"}
        </span>
      )}
    </Link>
  );
}

export { approvedLogo };

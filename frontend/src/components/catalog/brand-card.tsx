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
        "group flex h-40 flex-col items-center justify-center rounded-[--radius-lg] border border-[color:var(--border)] bg-white p-4 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[color:var(--brand-magenta)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-magenta)] focus-visible:ring-offset-2",
        className,
      )}
    >
      {showLogo ? (
        // Official logos are never recolored, stretched, or cropped.
        <span className="flex h-20 w-full items-center justify-center rounded-lg bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.logo_url ?? ""}
            alt={brand.logo_alt || brand.name}
            className="max-h-[4.5rem] max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
            onError={() => setFailedLogo(brand.logo_url ?? "")}
          />
        </span>
      ) : (
        <span className="font-display text-lg font-semibold text-[color:var(--brand-ink)]">{brand.name}</span>
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

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { POPULAR_SHORTCUTS } from "@/lib/config/popular-shortcuts";
import { cn } from "@/lib/utils/cn";

export function PopularShortcuts() {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeQuery = pathname === "/products" ? params.get("q")?.toLowerCase() : null;

  return (
    <nav aria-label="Popular product categories" className="border-t border-[color:var(--border)]">
      <div className="mx-auto w-full max-w-none overflow-x-auto px-4 py-2 sm:px-5 lg:px-6 2xl:px-8">
        <div className="flex w-max items-center gap-2 lg:w-auto lg:flex-wrap lg:justify-center">
          {POPULAR_SHORTCUTS.map((shortcut) => {
            const href = `/products?q=${encodeURIComponent(shortcut.query)}`;
            const active = activeQuery === shortcut.query;
            return (
              <Link
                key={shortcut.label}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                  active
                    ? "border-[color:var(--brand-magenta)] bg-[color:var(--brand-magenta)]/10 text-[color:var(--brand-magenta)]"
                    : "border-[color:var(--border)] text-[color:var(--brand-ink)] hover:border-[color:var(--brand-magenta)] hover:text-[color:var(--brand-magenta)]",
                )}
              >
                {shortcut.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

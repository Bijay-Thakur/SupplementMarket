"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X, CircleUserRound } from "lucide-react";
import { PRIMARY_NAV } from "@/lib/config/navigation";
import { features } from "@/lib/config/features";

/**
 * Mobile navigation slide-over. Focus is moved into the panel on open, Escape
 * closes it, body scroll is locked, and focus returns to the trigger on close.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[--radius] text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)] lg:hidden"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Menu className="h-6 w-6" aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col bg-surface p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[--radius] hover:bg-[color:var(--brand-cream)]"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" aria-hidden />
              </button>
            </div>
            <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-[--radius] px-3 py-3 text-base font-medium text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
                >
                  {item.label}
                </Link>
              ))}
              {(features.mockAuth || features.customerAuth) && (
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-3 rounded-[--radius] px-3 py-3 text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
                  aria-label="Account"
                >
                  <CircleUserRound className="h-5 w-5" aria-hidden />
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

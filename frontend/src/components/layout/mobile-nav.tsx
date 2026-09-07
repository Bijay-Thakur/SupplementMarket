"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { PRIMARY_NAV } from "@/lib/config/navigation";
import { AccountMenu } from "./account-menu";
import { SwitchExperienceButton } from "@/components/entry/entry-experience";

export function MobileNav({
  signedIn,
  email,
}: {
  signedIn: boolean;
  email?: string | null;
}) {
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
              {!signedIn ? (
                <>
                  <Link
                    href="/auth/sign-in"
                    onClick={() => setOpen(false)}
                    className="rounded-[--radius] px-3 py-3 text-base font-medium hover:bg-[color:var(--brand-cream)]"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/sign-up"
                    onClick={() => setOpen(false)}
                    className="rounded-[--radius] px-3 py-3 text-base font-medium hover:bg-[color:var(--brand-cream)]"
                  >
                    Create Account
                  </Link>
                  <div className="mt-4 px-3">
                    <SwitchExperienceButton />
                  </div>
                </>
              ) : (
                <div className="mt-2">
                  <AccountMenu email={email} compact />
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { SignOutForm } from "@/components/auth/sign-out-form";

export function AccountMenu({
  email,
  compact = false,
}: {
  email?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className={
          compact
            ? "rounded-[--radius] px-3 py-3 text-left text-base font-medium hover:bg-[color:var(--brand-cream)]"
            : "rounded-[--radius] px-3 py-2 text-sm font-medium text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={compact ? undefined : "Account menu"}
        title={compact ? undefined : "Account"}
        onClick={() => setOpen((value) => !value)}
      >
        {compact ? "Account" : <CircleUserRound className="h-6 w-6" aria-hidden />}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-48 rounded-[--radius] border border-[color:var(--border)] bg-surface py-1 shadow-lg"
        >
          {email ? (
            <p className="truncate px-3 py-2 text-xs text-[color:var(--muted)]" title={email}>
              {email}
            </p>
          ) : null}
          <Link
            role="menuitem"
            href="/account"
            className="block px-3 py-2 text-sm hover:bg-[color:var(--brand-cream)]"
            onClick={() => setOpen(false)}
          >
            My Account
          </Link>
          <Link
            role="menuitem"
            href="/account/orders"
            className="block px-3 py-2 text-sm hover:bg-[color:var(--brand-cream)]"
            onClick={() => setOpen(false)}
          >
            Orders
          </Link>
          <Link
            role="menuitem"
            href="/account/profile"
            className="block px-3 py-2 text-sm hover:bg-[color:var(--brand-cream)]"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <SignOutForm
            next="/"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--brand-cream)]"
          >
            Sign Out
          </SignOutForm>
        </div>
      ) : null}
    </div>
  );
}

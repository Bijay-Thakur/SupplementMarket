"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { SignOutForm } from "@/components/auth/sign-out-form";

export function AdminAccountMenu({ email }: { email?: string | null }) {
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
        className="w-full rounded-[--radius] px-3 py-2 text-left text-sm font-medium hover:bg-[color:var(--brand-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Account
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-44 rounded-[--radius] border border-[color:var(--border)] bg-surface py-1 shadow-lg md:bottom-auto md:top-full md:mb-0 md:mt-1"
        >
          {email ? (
            <p className="truncate px-3 py-2 text-xs text-[color:var(--muted)]" title={email}>
              {email}
            </p>
          ) : null}
          <Link
            role="menuitem"
            href="/admin/profile"
            className="block px-3 py-2 text-sm hover:bg-[color:var(--brand-cream)]"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            role="menuitem"
            href="/admin/settings"
            className="block px-3 py-2 text-sm hover:bg-[color:var(--brand-cream)]"
            onClick={() => setOpen(false)}
          >
            Store Settings
          </Link>
          <SignOutForm
            next="/"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--brand-cream)]"
          />
        </div>
      ) : null}
    </div>
  );
}

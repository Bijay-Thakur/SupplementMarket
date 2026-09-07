"use client";

import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { clearEntryMode } from "@/lib/entry-mode";

/** Auth chrome. Clearing the entry preference avoids / ↔ login loops. */
export function AuthShellHeader() {
  return (
    <header className="border-b border-[color:var(--border)] bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span onClickCapture={() => clearEntryMode()}>
          <Logo />
        </span>
        <Link
          href="/"
          className="text-sm font-medium text-[color:var(--muted)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => clearEntryMode()}
        >
          Back
        </Link>
      </div>
    </header>
  );
}

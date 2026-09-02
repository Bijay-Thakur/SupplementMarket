"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";
import { features } from "@/lib/config/features";

/** Account entry: profile icon only. Label is for assistive tech. */
export function AccountLink() {
  if (!features.mockAuth && !features.customerAuth) return null;
  return (
    <Link
      href="/account"
      className="inline-flex h-11 w-11 items-center justify-center rounded-[--radius] text-[color:var(--brand-ink)] hover:bg-[color:var(--brand-cream)]"
      aria-label="Account"
    >
      <CircleUserRound className="h-5 w-5" aria-hidden />
    </Link>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ADMIN_FORBIDDEN_MESSAGE } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Access denied", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Access denied</h1>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{ADMIN_FORBIDDEN_MESSAGE}</p>
      <p className="mt-6 text-sm">
        <Link href="/account" className="text-[color:var(--brand-magenta)] underline">
          Go to your account
        </Link>
      </p>
    </Container>
  );
}

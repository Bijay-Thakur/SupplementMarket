import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { EXPIRED_LINK_MESSAGE } from "@/lib/auth/types";

export const metadata: Metadata = { title: "Authentication error", robots: { index: false } };

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message =
    reason === "expired"
      ? EXPIRED_LINK_MESSAGE
      : reason === "config"
        ? "Authentication is not configured on this server."
        : "The sign-in link could not be completed. Request a new email and try again.";

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Could not continue</h1>
      <p className="mt-3 text-sm text-[color:var(--muted)]">{message}</p>
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/auth/sign-in" className="text-[color:var(--brand-magenta)] underline">
          Sign in
        </Link>
        <Link href="/auth/forgot-password" className="text-[color:var(--brand-magenta)] underline">
          Reset password
        </Link>
        <Link href="/auth/sign-up" className="text-[color:var(--brand-magenta)] underline">
          Create account
        </Link>
      </div>
    </Container>
  );
}

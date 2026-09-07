import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResendConfirmationForm } from "@/components/auth/resend-confirmation-form";

export const metadata: Metadata = { title: "Check your email", robots: { index: false } };

export default function CheckEmailPage() {
  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Check your email</h1>
      <p className="mt-3 text-sm text-[color:var(--muted)]">
        If a confirmation is required, open the link we sent to finish creating
        your account. The link expires after a short time.
      </p>
      <ResendConfirmationForm />
      <p className="mt-6 text-sm">
        <Link href="/auth/sign-in" className="text-[color:var(--brand-magenta)] underline">
          Back to sign in
        </Link>
      </p>
    </Container>
  );
}

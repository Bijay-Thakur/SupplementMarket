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
        If this is a new account, open the confirmation link we sent to finish
        creating it. For security, we show this same message when an account
        already exists; in that case, no new email is sent.
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

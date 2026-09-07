"use client";

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PASSWORD_RESET_GENERIC } from "@/lib/auth/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Forgot password</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Enter your email. If an account exists, you will receive reset instructions.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            await fetch("/api/auth?action=forgot-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email }),
            });
            setMessage(PASSWORD_RESET_GENERIC);
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block text-sm font-medium" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
        />
        <button type="submit" disabled={pending} className={buttonVariants({ size: "lg" })}>
          {pending ? "Sending…" : "Continue"}
        </button>
      </form>
      {message && <p className="mt-4 text-sm">{message}</p>}
      <p className="mt-6 text-sm">
        <Link href="/auth/sign-in" className="text-[color:var(--brand-magenta)] underline">
          Back to sign in
        </Link>
      </p>
    </Container>
  );
}

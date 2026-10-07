"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PASSWORD_RESET_GENERIC } from "@/lib/auth/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);

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
          setMessage(null);
          setError(null);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Enter a valid email.");
            return;
          }
          setPending(true);
          try {
            const response = await fetch("/api/auth?action=forgot-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ email, company: companyRef.current?.value || "" }),
            });
            const data = await response.json();
            if (!response.ok) {
              setError(data.detail || "Unable to request a reset. Please try again.");
              return;
            }
            setMessage(PASSWORD_RESET_GENERIC);
          } catch {
            setError("The network request failed. Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company">
            Company
            <input ref={companyRef} id="company" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
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
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-[color:var(--danger)]">{error}</p>}
      <p className="mt-6 text-sm">
        <Link href="/auth/sign-in" className="text-[color:var(--brand-magenta)] underline">
          Back to sign in
        </Link>
      </p>
    </Container>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Leaf, PackageCheck, ShieldCheck } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ADMIN_FORBIDDEN_MESSAGE, AUTH_GENERIC_ERROR, UNCONFIRMED_EMAIL_MESSAGE } from "@/lib/auth/types";

function errorMessage(code: string | null) {
  if (code === "forbidden") return ADMIN_FORBIDDEN_MESSAGE;
  if (code === "unconfirmed") return UNCONFIRMED_EMAIL_MESSAGE;
  if (code === "config") return "Authentication is not configured.";
  if (code === "auth") return AUTH_GENERIC_ERROR;
  return null;
}

function adminNextPath(next: string | null) {
  if (next && next.startsWith("/admin") && !next.startsWith("/admin/login")) return next;
  return "/admin";
}

export default function SignInForm({ admin = false }: { admin?: boolean }) {
  const params = useSearchParams();
  const next = admin
    ? adminNextPath(params.get("next"))
    : params.get("next") || "/products";
  const resetOk = params.get("reset") === "1";
  const error = errorMessage(params.get("error"));
  const [pending, setPending] = useState(false);

  return (
    <Container className="relative isolate grid min-h-[calc(100vh-5rem)] max-w-5xl place-items-center overflow-hidden py-10 sm:py-14">
      <div className="pointer-events-none absolute -left-24 top-8 -z-10 h-64 w-64 rounded-full bg-[color:var(--brand-green)]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-4 -z-10 h-72 w-72 rounded-full bg-[color:var(--brand-magenta)]/10 blur-3xl" />

      <div className="grid w-full overflow-hidden rounded-[2rem] border border-[color:var(--border)] bg-white shadow-[0_24px_70px_rgba(24,48,27,0.13)] lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden bg-[color:var(--brand-green-strong)] px-7 py-9 text-white sm:px-10 lg:px-11 lg:py-12">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border-[28px] border-white/10" />
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[color:var(--brand-gold)]/20" />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
              <Leaf className="h-4 w-4" aria-hidden="true" />
              Bronxville wellness
            </span>
            <h2 className="mt-7 max-w-md font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {admin ? "Your catalog tools, securely within reach." : "A simpler way to care for your routine."}
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/80">
              {admin
                ? "Manage products, orders, brands, and store details from one protected workspace."
                : "Sign in to keep your wellness shopping organized and make every visit feel familiar."}
            </p>

            <ul className="mt-8 space-y-4 text-sm text-white/90">
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12">
                  <PackageCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                {admin ? "Keep catalog and order details together" : "Review orders and pickup details"}
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12">
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                {admin ? "Administrator access is verified server-side" : "Secure access to your account"}
              </li>
            </ul>
          </div>
        </aside>

        <section className="px-6 py-9 sm:px-10 lg:px-12 lg:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-magenta)]">
            {admin ? "Administrator portal" : "Welcome back"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            {admin ? "Admin sign in" : "Sign in to your account"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            {admin
              ? "Use your administrator credentials to continue to store management."
              : "Enter your email and password to continue."}
          </p>

          {resetOk ? (
            <p className="mt-5 rounded-[--radius] border border-[color:var(--brand-green)]/30 bg-[color:var(--brand-green)]/10 px-4 py-3 text-sm text-[color:var(--brand-green-strong)]">
              Password updated. Sign in with your new password.
            </p>
          ) : null}

          <form
            action="/api/auth/session"
            method="post"
            className="mt-7 space-y-5"
            onSubmit={() => setPending(true)}
          >
            <input type="hidden" name="portal" value={admin ? "admin" : "customer"} />
            <input type="hidden" name="next" value={next} />
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-[color:var(--brand-ink)]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                aria-invalid={Boolean(error)}
                className="mt-2 block h-12 w-full rounded-[--radius] border border-[color:var(--brand-green)]/40 bg-white px-4 shadow-[inset_0_1px_2px_rgba(24,48,27,0.05)] outline-none transition placeholder:text-[color:var(--muted)]/70 focus:border-[color:var(--brand-magenta)] focus:ring-2 focus:ring-[color:var(--brand-magenta)]/15"
              />
            </div>
            <PasswordField
              id="password"
              name="password"
              label="Password"
              autoComplete="current-password"
              required
            />
            {error ? (
              <p role="alert" className="rounded-[--radius] bg-red-50 px-4 py-3 text-sm text-[color:var(--danger)]">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={pending} aria-busy={pending} className={buttonVariants({ size: "lg", className: "w-full shadow-[0_10px_24px_rgba(178,30,82,0.18)]" })}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 border-t border-[color:var(--border)] pt-5 text-sm">
            <Link href="/auth/forgot-password" className="font-medium text-[color:var(--brand-magenta)] underline decoration-transparent underline-offset-4 transition hover:decoration-current">
              Forgot password?
            </Link>
            {!admin && (
              <p className="mt-3 text-[color:var(--muted)]">
                New here?{" "}
                <Link href="/auth/sign-up" className="font-semibold text-[color:var(--brand-magenta)] underline decoration-transparent underline-offset-4 transition hover:decoration-current">
                  Create an account
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </Container>
  );
}

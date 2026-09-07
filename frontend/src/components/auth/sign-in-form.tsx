"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
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
    : params.get("next") || "/account";
  const resetOk = params.get("reset") === "1";
  const error = errorMessage(params.get("error"));
  const [pending, setPending] = useState(false);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">{admin ? "Admin sign in" : "Sign in"}</h1>
      {admin ? (
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Sign in with an administrator account. Access is granted only after the
          server confirms the administrator role.
        </p>
      ) : null}
      {resetOk ? (
        <p className="mt-4 text-sm text-[color:var(--brand-green)]">Password updated. Sign in with your new password.</p>
      ) : null}
      <form
        action="/api/auth/session"
        method="post"
        className="mt-6 space-y-4"
        onSubmit={() => setPending(true)}
      >
        <input type="hidden" name="portal" value={admin ? "admin" : "customer"} />
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
          />
        </div>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          required
        />
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
        <button type="submit" disabled={pending} aria-busy={pending} className={buttonVariants({ size: "lg", className: "w-full" })}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/auth/forgot-password" className="text-[color:var(--brand-magenta)] underline">
          Forgot password?
        </Link>
      </p>
      {!admin && (
        <p className="mt-2 text-sm">
          New here?{" "}
          <Link href="/auth/sign-up" className="text-[color:var(--brand-magenta)] underline">
            Create an account
          </Link>
        </p>
      )}
    </Container>
  );
}

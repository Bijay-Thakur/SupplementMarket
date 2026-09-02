"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { features } from "@/lib/config/features";

export default function SignInForm({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || (admin ? "/admin" : "/account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(action: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/auth?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(extra),
      });
      const data = (await res.json()) as { detail?: string; redirectTo?: string };
      if (!res.ok) {
        setError(data.detail || "Could not complete sign-in.");
        return;
      }
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      router.push(next.startsWith("/") ? next : admin ? "/admin" : "/account");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">{admin ? "Admin sign in" : "Sign in"}</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("sign-in", { email, password });
        }}
      >
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        <button type="submit" disabled={pending} className={buttonVariants({ size: "lg", className: "w-full" })}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        className={buttonVariants({ variant: "outline", size: "lg", className: "mt-3 w-full" })}
        onClick={() => void submit("google", { roleHint: admin ? "admin" : "customer", next })}
      >
        Continue with Google{features.mockAuth ? " — Demo" : ""}
      </button>
      {admin && features.mockAuth && (
        <button
          type="button"
          disabled={pending}
          className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-3 w-full" })}
          onClick={() => void submit("demo-continue", { role: "admin" })}
        >
          Continue as demo administrator
        </button>
      )}
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

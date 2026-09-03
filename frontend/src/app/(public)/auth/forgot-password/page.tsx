"use client";

import { useState } from "react";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Forgot password</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/auth?action=forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email }),
          });
          const data = (await res.json()) as { message?: string };
          setMessage(data.message || "If an account exists for that address, continue with the next step shown here.");
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
        <button type="submit" className={buttonVariants({ size: "lg" })}>
          Continue
        </button>
      </form>
      {message && <p className="mt-4 text-sm">{message}</p>}
    </Container>
  );
}

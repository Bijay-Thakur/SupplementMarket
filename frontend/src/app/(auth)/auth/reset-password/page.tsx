"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EXPIRED_LINK_MESSAGE } from "@/lib/auth/types";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Set a new password</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setPending(true);
          try {
            const res = await fetch("/api/auth?action=update-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ password, confirmPassword: confirm }),
            });
            const data = (await res.json()) as { detail?: string; redirectTo?: string };
            if (!res.ok) {
              setError(data.detail || EXPIRED_LINK_MESSAGE);
              return;
            }
            setSuccess(true);
            router.push(data.redirectTo || "/auth/sign-in?reset=1");
          } catch {
            setError("The network request failed. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
        />
        <PasswordField
          id="confirm"
          label="Confirm password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={setConfirm}
        />
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        {success && <p className="text-sm text-[color:var(--brand-green)]">Password updated. Redirecting to sign in…</p>}
        <button type="submit" disabled={pending} className={buttonVariants({ size: "lg" })}>
          {pending ? "Saving…" : "Save password"}
        </button>
      </form>
    </Container>
  );
}

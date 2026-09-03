"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Set a new password</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== confirm) {
            setError("Passwords do not match.");
            return;
          }
          const res = await fetch("/api/auth?action=update-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ password }),
          });
          const data = (await res.json()) as { detail?: string };
          if (!res.ok) {
            setError(data.detail || "Could not update password.");
            return;
          }
          router.push("/account");
        }}
      >
        <PasswordField id="password" label="New password" autoComplete="new-password" required value={password} onChange={setPassword} />
        <PasswordField id="confirm" label="Confirm password" autoComplete="new-password" required value={confirm} onChange={setConfirm} />
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        <button type="submit" className={buttonVariants({ size: "lg" })}>
          Save password
        </button>
      </form>
    </Container>
  );
}

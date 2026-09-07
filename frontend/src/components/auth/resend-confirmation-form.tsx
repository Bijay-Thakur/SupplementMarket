"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

export function ResendConfirmationForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setMessage(null);
        try {
          const res = await fetch("/api/auth?action=resend-confirmation", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = (await res.json()) as { message?: string };
          if (!res.ok) {
            setError("Could not request another confirmation email. Try again.");
            return;
          }
          setMessage(data.message || "If that address still needs confirmation, another email is on the way.");
        } catch {
          setError("The network request failed. Try again.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor="resend-email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="resend-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
      />
      <button type="submit" disabled={pending} className={buttonVariants({ size: "sm" })}>
        {pending ? "Sending…" : "Resend confirmation email"}
      </button>
      {message ? <p className="text-sm text-[color:var(--brand-green)]">{message}</p> : null}
      {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
    </form>
  );
}

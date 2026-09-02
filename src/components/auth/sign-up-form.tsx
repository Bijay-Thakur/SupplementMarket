"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function SignUpForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Create account</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          setFields({});
          try {
            const res = await fetch("/api/auth?action=sign-up", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(form),
            });
            const data = (await res.json()) as {
              detail?: string;
              fields?: Record<string, string>;
              needsVerification?: boolean;
            };
            if (!res.ok) {
              setFields(data.fields ?? {});
              setError(data.detail || "Could not create the account.");
              return;
            }
            router.push(data.needsVerification ? "/auth/sign-in" : "/account");
            router.refresh();
          } finally {
            setPending(false);
          }
        }}
      >
        <Field id="username" label="Username" autoComplete="username" value={form.username} error={fields.username} onChange={(username) => setForm({ ...form, username })} />
        <Field id="firstName" label="First name" autoComplete="given-name" value={form.firstName} error={fields.firstName} onChange={(firstName) => setForm({ ...form, firstName })} />
        <Field id="lastName" label="Last name" autoComplete="family-name" value={form.lastName} error={fields.lastName} onChange={(lastName) => setForm({ ...form, lastName })} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} error={fields.email} onChange={(email) => setForm({ ...form, email })} />
        <PasswordField id="password" label="Password" autoComplete="new-password" required value={form.password} onChange={(password) => setForm({ ...form, password })} error={fields.password} />
        <PasswordField id="confirmPassword" label="Confirm password" autoComplete="new-password" required value={form.confirmPassword} onChange={(confirmPassword) => setForm({ ...form, confirmPassword })} error={fields.confirmPassword} />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(e) => setForm({ ...form, acceptedTerms: e.target.checked })}
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>
            .
          </span>
        </label>
        {fields.acceptedTerms && <p className="text-sm text-[color:var(--danger)]">{fields.acceptedTerms}</p>}
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        <button type="submit" disabled={pending} className={buttonVariants({ size: "lg", className: "w-full" })}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="text-[color:var(--brand-magenta)] underline">
          Sign in
        </Link>
      </p>
    </Container>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
  type = "text",
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  type?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
      />
      {error && <p className="mt-1 text-sm text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}

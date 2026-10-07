"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { validateSignUp } from "@/lib/auth/types";

export default function SignUpForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const companyRef = useRef<HTMLInputElement>(null);

  return (
    <Container className="max-w-md py-12">
      <h1 className="font-display text-3xl font-semibold">Create account</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setFields({});
          const problems = validateSignUp({ ...form, acceptedTerms });
          if (Object.keys(problems).length) {
            setFields(problems);
            setError("Please correct the highlighted fields.");
            return;
          }
          setPending(true);
          try {
            const res = await fetch("/api/auth?action=sign-up", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                ...form,
                acceptedTerms,
                company: companyRef.current?.value || "",
              }),
            });
            const data = (await res.json()) as {
              detail?: string;
              fields?: Record<string, string>;
              needsVerification?: boolean;
              redirectTo?: string;
            };
            if (!res.ok) {
              setFields(data.fields ?? {});
              setError(data.detail || "Could not create the account.");
              return;
            }
            router.push(data.redirectTo || (data.needsVerification ? "/auth/check-email" : "/products"));
            router.refresh();
          } catch {
            setError("The network request failed. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          value={form.username}
          error={fields.username}
          onChange={(username) => setForm({ ...form, username })}
        />
        <Field
          id="fullName"
          label="Full name"
          autoComplete="name"
          value={form.fullName}
          error={fields.fullName}
          onChange={(fullName) => setForm({ ...form, fullName })}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          error={fields.email}
          onChange={(email) => setForm({ ...form, email })}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(password) => setForm({ ...form, password })}
          error={fields.password}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          required
          value={form.confirmPassword}
          onChange={(confirmPassword) => setForm({ ...form, confirmPassword })}
          error={fields.confirmPassword}
        />
        <div className="hidden" aria-hidden="true">
          <label htmlFor="company">
            Company
            <input ref={companyRef} id="company" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="flex items-start gap-2 text-sm text-[color:var(--brand-ink)]">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          <span>
            I agree to the <Link href="/terms" className="text-[color:var(--brand-magenta-strong)] underline">Terms</Link> and{" "}
            <Link href="/privacy" className="text-[color:var(--brand-magenta-strong)] underline">Privacy Policy</Link>.
          </span>
        </label>
        {fields.acceptedTerms ? <p className="text-sm text-[color:var(--danger)]">{fields.acceptedTerms}</p> : null}
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

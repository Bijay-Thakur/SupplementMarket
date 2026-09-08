"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import type { AuthUser } from "@/lib/auth/types";
import { MISSING_PROFILE_MESSAGE, MISSING_ROLE_MESSAGE } from "@/lib/auth/types";

export function AccountProfile({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [form, setForm] = useState({
    username: user.username,
    fullName: user.fullName,
    phone: user.phone ?? "",
    avatarUrl: user.avatarUrl ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const created = user.createdAt
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(user.createdAt))
    : "Unknown";

  return (
    <Container className="max-w-2xl py-12">
      <h1 className="font-display text-3xl font-semibold">Your account</h1>
      {user.missingProfile ? <p className="mt-3 text-sm text-[color:var(--danger)]">{MISSING_PROFILE_MESSAGE}</p> : null}
      {user.missingRole ? <p className="mt-3 text-sm text-[color:var(--danger)]">{MISSING_ROLE_MESSAGE}</p> : null}

      <dl className="mt-8 grid gap-3 text-sm">
        <div>
          <dt className="font-medium">Email</dt>
          <dd>
            {user.email} {user.emailVerified ? "(verified)" : "(unverified)"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Account created</dt>
          <dd>{created}</dd>
        </div>
      </dl>

      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setError(null);
          setMessage(null);
          try {
            const res = await fetch("/api/account/profile", {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            });
            const data = (await res.json()) as {
              detail?: string;
              profile?: {
                username: string;
                fullName: string;
                phone: string;
                avatarUrl: string;
              };
            };
            if (!res.ok) {
              setError(data.detail || "Could not save profile.");
              return;
            }
            if (data.profile) {
              setForm(data.profile);
            }
            setMessage("Profile saved to your account.");
            router.refresh();
          } catch {
            setError("The network request failed. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field id="username" label="Username" value={form.username} onChange={(username) => setForm({ ...form, username })} />
        <Field id="fullName" label="Full name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
        <Field id="phone" label="Phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        <Field
          id="avatarUrl"
          label="Avatar URL"
          value={form.avatarUrl}
          onChange={(avatarUrl) => setForm({ ...form, avatarUrl })}
        />
        {form.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : null}
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
        {message ? <p className="text-sm text-[color:var(--brand-green)]">{message}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className={buttonVariants()}>
            {pending ? "Saving…" : "Save profile"}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: "ghost" })}
            onClick={async () => {
              await fetch("/api/auth?action=sign-out", { method: "POST", credentials: "include" });
              router.push("/");
              router.refresh();
            }}
          >
            Sign out
          </button>
        </div>
      </form>
    </Container>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
      />
    </div>
  );
}

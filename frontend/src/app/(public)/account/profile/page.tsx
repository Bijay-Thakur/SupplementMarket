"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { DemoAuthBanner } from "@/components/auth/demo-banner";
import type { AuthUser } from "@/lib/auth/types";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState({ displayName: "", firstName: "", lastName: "", username: "", phone: "", avatarUrl: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/account/profile", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          router.push("/auth/sign-in?next=/account/profile");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data?.user) return;
        const u = data.user as AuthUser;
        setUser(u);
        setForm({
          displayName: u.displayName ?? "",
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          username: u.username ?? "",
          phone: u.phone ?? "",
          avatarUrl: u.avatarUrl ?? "",
        });
      });
  }, [router]);

  if (!user) {
    return (
      <Container className="py-12">
        <p>Loading profile…</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-lg py-12">
      <h1 className="font-display text-3xl font-semibold">Edit profile</h1>
      <div className="mt-4">
        <DemoAuthBanner />
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const res = await fetch("/api/v1/account/profile", {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.detail || "Could not save profile.");
            return;
          }
          setMessage("Profile saved.");
        }}
      >
        {(["displayName", "firstName", "lastName", "username", "phone"] as const).map((key) => (
          <div key={key}>
            <label className="text-sm font-medium" htmlFor={key}>
              {key}
            </label>
            <input
              id={key}
              className="mt-1 block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </div>
        ))}
        <div>
          <label className="text-sm font-medium" htmlFor="avatar">
            Avatar
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file || file.size > 200_000) {
                if (file) setError("Use an image under 200 KB for the demo avatar.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setForm((f) => ({ ...f, avatarUrl: String(reader.result) }));
              reader.readAsDataURL(file);
            }}
          />
        </div>
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        {message && <p className="text-sm text-[color:var(--brand-green)]">{message}</p>}
        <button type="submit" className={buttonVariants()}>
          Save profile
        </button>
      </form>
    </Container>
  );
}

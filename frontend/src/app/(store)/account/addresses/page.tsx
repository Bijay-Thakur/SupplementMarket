"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import type { CustomerAddress } from "@/lib/auth/types";

const empty = {
  label: "Home",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "NY",
  postalCode: "",
  deliveryInstructions: "",
  isDefault: true,
};

export default function AddressesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/v1/account/addresses", { credentials: "include" }).then(async (r) => {
      if (r.status === 401) {
        router.push("/auth/sign-in?next=/account/addresses");
        return;
      }
      setRows((await r.json()) as CustomerAddress[]);
    });
  }

  useEffect(() => {
    load();
    // initial fetch only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container className="max-w-xl py-12">
      <h1 className="font-display text-3xl font-semibold">Saved addresses</h1>
      {rows.length === 0 && <p className="mt-4 text-sm text-[color:var(--muted)]">You have not saved an address yet.</p>}
      <ul className="mt-6 space-y-3">
        {rows.map((a) => (
          <li key={a.id} className="flex items-start justify-between rounded-[--radius] border border-[color:var(--border)] bg-surface p-4 text-sm">
            <div>
              <p className="font-semibold">
                {a.label} {a.isDefault ? "(default)" : ""}
              </p>
              <p>
                {a.recipientName}
                <br />
                {a.addressLine1}
                {a.addressLine2 ? `, ${a.addressLine2}` : ""}
                <br />
                {a.city}, {a.state} {a.postalCode}
              </p>
            </div>
            <button
              type="button"
              className="text-[color:var(--danger)]"
              onClick={async () => {
                await fetch(`/api/v1/account/addresses/${a.id}`, { method: "DELETE", credentials: "include" });
                load();
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-8 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const res = await fetch("/api/v1/account/addresses", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
          if (!res.ok) {
            setError("Could not save that address.");
            return;
          }
          setForm(empty);
          load();
        }}
      >
        <h2 className="font-display text-xl font-semibold">Add address</h2>
        {(["label", "recipientName", "phone", "addressLine1", "addressLine2", "city", "state", "postalCode"] as const).map((key) => (
          <input
            key={key}
            required={key !== "addressLine2" && key !== "phone"}
            placeholder={key}
            className="block h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
          Default address
        </label>
        {error && <p className="text-sm text-[color:var(--danger)]">{error}</p>}
        <button type="submit" className={buttonVariants()}>
          Save address
        </button>
      </form>
    </Container>
  );
}

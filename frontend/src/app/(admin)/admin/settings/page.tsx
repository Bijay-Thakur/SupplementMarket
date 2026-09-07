"use client";

import { useQuery } from "@tanstack/react-query";
import { adminUpdateSettings, getStoreSettings } from "@/lib/api/catalog";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

export default function AdminSettingsPage() {
  const q = useQuery({ queryKey: ["store-settings"], queryFn: getStoreSettings });
  const [msg, setMsg] = useState<string | null>(null);
  const s = q.data;
  if (!s) return <p>Loading…</p>;
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        adminUpdateSettings({
          announcement: fd.get("announcement"),
          hours_note: fd.get("hours_note"),
          pickup_instructions: fd.get("pickup_instructions"),
          delivery_note: fd.get("delivery_note"),
          email: fd.get("email") || null,
        }).then(() => {
          setMsg("Saved.");
          q.refetch();
        });
      }}
    >
      <h1 className="font-display text-3xl font-semibold">Store settings</h1>
      <p className="text-sm text-[color:var(--muted)]">
        Phone, email, address, and hours are owner-verified.
      </p>
      <p className="text-sm">
        Address: {s.address_line1}, {s.city}, {s.state} {s.zip}
      </p>
      <p className="text-sm">Phone: {s.phone_is_placeholder ? "Not configured" : s.phone}</p>
      <label className="block text-sm">
        Email
        <input name="email" className="fld" defaultValue={s.email ?? ""} />
      </label>
      <label className="block text-sm">
        Announcement
        <input name="announcement" className="fld" defaultValue={s.announcement ?? ""} />
      </label>
      <label className="block text-sm">
        Hours note
        <textarea name="hours_note" className="fld" defaultValue={s.hours_note ?? ""} />
      </label>
      <label className="block text-sm">
        Pickup instructions
        <textarea name="pickup_instructions" className="fld" defaultValue={s.pickup_instructions ?? ""} />
      </label>
      <label className="block text-sm">
        Delivery note
        <textarea name="delivery_note" className="fld" defaultValue={s.delivery_note ?? ""} />
      </label>
      <button className={buttonVariants()}>Save</button>
      {msg && <p className="text-sm text-[color:var(--success)]">{msg}</p>}
    </form>
  );
}

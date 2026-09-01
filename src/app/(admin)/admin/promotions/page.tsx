"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";

type Promo = {
  id: number;
  name: string;
  description: string | null;
  discount_percent: number | null;
  is_active: boolean;
};

export default function PromotionsPage() {
  const q = useQuery({
    queryKey: ["promos"],
    queryFn: () => apiFetch<Promo[]>("/api/v1/admin/promotions"),
  });
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("10");

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold">Sale windows</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Named promotions for merchandising. Customer prices still come from each
        product&apos;s regular and sale cents.
      </p>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apiFetch("/api/v1/admin/promotions", {
            method: "POST",
            body: JSON.stringify({
              name,
              discount_percent: Number(percent),
              is_active: true,
            }),
          }).then(() => {
            setName("");
            q.refetch();
          });
        }}
      >
        <input className="fld" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="fld w-24" value={percent} onChange={(e) => setPercent(e.target.value)} />
        <button className={buttonVariants()}>Add</button>
      </form>
      <ul className="mt-6 space-y-2">
        {(q.data ?? []).map((p) => (
          <li key={p.id} className="rounded border border-[color:var(--border)] bg-surface px-3 py-2">
            {p.name} {p.discount_percent ? `(${p.discount_percent}% label)` : ""}{" "}
            {p.is_active ? "" : "(paused)"}
          </li>
        ))}
      </ul>
    </div>
  );
}

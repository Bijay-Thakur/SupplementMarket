"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@/components/ui/button";

type CustomerRow = {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string;
};

export default function AdminCustomersPage() {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/customers", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not load customers.");
      return data.items as CustomerRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "CONFIRM" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not remove that customer.");
    },
    onSuccess: () => {
      setPendingId(null);
      setConfirmation("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Customers</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Remove deletes the customer account and profile from the database. Type
        CONFIRM before the deletion proceeds.
      </p>
      {list.isError && <p className="mt-4 text-sm text-[color:var(--danger)]">Could not load customers.</p>}
      {error && <p className="mt-4 text-sm text-[color:var(--danger)]">{error}</p>}
      <ul className="mt-6 divide-y rounded-[--radius] border border-[color:var(--border)] bg-surface">
        {(list.data ?? []).map((customer) => (
          <li key={customer.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">{customer.full_name || customer.username || customer.email}</p>
                <p className="text-[color:var(--muted)]">
                  {customer.email}
                  {customer.username ? ` · @${customer.username}` : ""}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </p>
              </div>
              {pendingId === customer.id ? (
                <div className="w-full max-w-sm space-y-2">
                  <p className="text-sm">
                    Remove this customer and delete their information from the database?
                    Type CONFIRM to continue.
                  </p>
                  <input
                    aria-label="Type CONFIRM to remove"
                    className="h-11 w-full rounded-[--radius] border border-[color:var(--border)] bg-surface px-3"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={buttonVariants({ variant: "outline" })}
                      onClick={() => {
                        setPendingId(null);
                        setConfirmation("");
                        setError(null);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={confirmation !== "CONFIRM" || remove.isPending}
                      className={buttonVariants()}
                      onClick={() => remove.mutate(customer.id)}
                    >
                      {remove.isPending ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={buttonVariants({ variant: "outline" })}
                  onClick={() => {
                    setPendingId(customer.id);
                    setConfirmation("");
                    setError(null);
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
        {list.data?.length === 0 && (
          <li className="px-4 py-8 text-sm text-[color:var(--muted)]">No customers yet.</li>
        )}
      </ul>
    </div>
  );
}

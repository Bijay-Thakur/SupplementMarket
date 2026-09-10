"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminListBrands,
  adminUpdateBrand,
  createBrand,
} from "@/lib/api/catalog";
import type { Brand } from "@/lib/api/types";

export default function AdminBrandsPage() {
  const queryClient = useQueryClient();
  const brands = useQuery({ queryKey: ["admin-brands"], queryFn: adminListBrands });
  const [brandName, setBrandName] = useState("");
  const [discount, setDiscount] = useState("");
  const [formError, setFormError] = useState("");

  const create = useMutation({
    mutationFn: (body: { name: string; discount_percent?: number }) => createBrand(body),
    onSuccess: async () => {
      setBrandName("");
      setDiscount("");
      setFormError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-brands"] }),
        queryClient.invalidateQueries({ queryKey: ["brands"] }),
      ]);
    },
  });

  return (
    <section className="max-w-4xl">
      <h1 className="font-display text-3xl font-semibold">Brands</h1>
      <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
        Set one discount for a brand. Saving it recalculates every product&apos;s Store SRP from its MSRP.
        Enter 0% to remove the brand sale price.
      </p>

      <form
        className="mt-6 grid gap-3 rounded-[--radius-lg] border bg-white p-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = discount === "" ? undefined : Number(discount);
          if (parsed != null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 99)) {
            setFormError("Discount must be a whole number from 0 to 99.");
            return;
          }
          setFormError("");
          create.mutate({ name: brandName.trim(), discount_percent: parsed });
        }}
      >
        <label className="text-sm font-medium">
          Brand name
          <input
            className="fld"
            value={brandName}
            onChange={(event) => setBrandName(event.target.value)}
            required
          />
        </label>
        <label className="text-sm font-medium">
          Discount %
          <input
            className="fld"
            type="number"
            min={0}
            max={99}
            step={1}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <button
          className="h-11 rounded-[--radius] bg-[color:var(--brand-green)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          disabled={create.isPending}
        >
          {create.isPending ? "Adding…" : "Add brand"}
        </button>
      </form>
      {(formError || create.error) && (
        <p className="mt-2 text-sm text-[color:var(--danger)]">
          {formError || create.error?.message}
        </p>
      )}

      <div className="mt-8 overflow-hidden rounded-[--radius-lg] border bg-white">
        <div className="grid grid-cols-[1fr_9rem_7rem] gap-3 border-b bg-[color:var(--brand-cream)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          <span>Brand</span>
          <span>Discount</span>
          <span className="sr-only">Action</span>
        </div>
        {brands.isLoading && <p className="p-4 text-sm text-[color:var(--muted)]">Loading brands…</p>}
        {brands.isError && <p className="p-4 text-sm text-[color:var(--danger)]">Could not load brands.</p>}
        {(brands.data ?? []).map((brand) => (
          <BrandDiscountRow key={brand.id} brand={brand} />
        ))}
      </div>
    </section>
  );
}

function BrandDiscountRow({ brand }: { brand: Brand }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(brand.discount_percent == null ? "" : String(brand.discount_percent));
  const [validation, setValidation] = useState("");

  const save = useMutation({
    mutationFn: (discountPercent: number) =>
      adminUpdateBrand(brand.id, { discount_percent: discountPercent }),
    onSuccess: async () => {
      setValidation("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-brands"] }),
        queryClient.invalidateQueries({ queryKey: ["brands"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
        queryClient.invalidateQueries({ queryKey: ["product"] }),
      ]);
    },
  });

  return (
    <form
      className="grid grid-cols-[1fr_9rem_7rem] items-center gap-3 border-b px-4 py-3 last:border-b-0"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = Number(value);
        if (value === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
          setValidation("Use 0–99.");
          return;
        }
        setValidation("");
        save.mutate(parsed);
      }}
    >
      <div>
        <p className="font-medium">{brand.name}</p>
        {(validation || save.error) && (
          <p className="mt-1 text-xs text-[color:var(--danger)]">{validation || save.error?.message}</p>
        )}
        {save.isSuccess && !save.isPending && !save.error && (
          <p className="mt-1 text-xs text-[color:var(--success)]">Prices updated.</p>
        )}
      </div>
      <label>
        <span className="sr-only">Discount percent for {brand.name}</span>
        <div className="relative">
          <input
            className="fld mt-0 pr-8"
            type="number"
            min={0}
            max={99}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Not set"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--muted)]">%</span>
        </div>
      </label>
      <button
        className="h-10 rounded-[--radius] border border-[color:var(--brand-green)] px-3 text-sm font-semibold text-[color:var(--brand-green-strong)] disabled:opacity-60"
        disabled={save.isPending}
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

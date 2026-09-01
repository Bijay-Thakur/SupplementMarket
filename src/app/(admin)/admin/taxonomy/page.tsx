"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createBrand, createCategory, createTag, listBrands, listCategories, listTags } from "@/lib/api/catalog";

export default function TaxonomyPage() {
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const tags = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const [brandName, setBrandName] = useState("");
  const [catName, setCatName] = useState("");
  const [tagName, setTagName] = useState("");

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <section>
        <h1 className="font-display text-2xl font-semibold">Brands</h1>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createBrand({ name: brandName }).then(() => {
              setBrandName("");
              brands.refetch();
            });
          }}
        >
          <input className="fld" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
          <button className="h-11 rounded bg-[color:var(--brand-green)] px-3 text-sm text-white">Add</button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {(brands.data ?? []).map((b) => (
            <li key={b.id}>{b.name}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">Categories</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createCategory({ name: catName }).then(() => {
              setCatName("");
              cats.refetch();
            });
          }}
        >
          <input className="fld" value={catName} onChange={(e) => setCatName(e.target.value)} required />
          <button className="h-11 rounded bg-[color:var(--brand-green)] px-3 text-sm text-white">Add</button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {(cats.data ?? []).map((c) => (
            <li key={c.id}>{c.name}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl font-semibold">Tags</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createTag({ name: tagName, kind: "wellness" }).then(() => {
              setTagName("");
              tags.refetch();
            });
          }}
        >
          <input className="fld" value={tagName} onChange={(e) => setTagName(e.target.value)} required />
          <button className="h-11 rounded bg-[color:var(--brand-green)] px-3 text-sm text-white">Add</button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {(tags.data ?? []).map((t) => (
            <li key={t.id}>{t.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

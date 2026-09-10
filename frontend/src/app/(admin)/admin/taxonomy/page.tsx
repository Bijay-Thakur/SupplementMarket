"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createCategory,
  createTag,
  listCategories,
  listTags,
} from "@/lib/api/catalog";

export default function TaxonomyPage() {
  const categories = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const tags = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const [categoryName, setCategoryName] = useState("");
  const [tagName, setTagName] = useState("");

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h1 className="font-display text-2xl font-semibold">Categories</h1>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            createCategory({ name: categoryName }).then(() => {
              setCategoryName("");
              categories.refetch();
            });
          }}
        >
          <input
            className="fld"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            required
          />
          <button className="h-11 rounded bg-[color:var(--brand-green)] px-3 text-sm text-white">
            Add
          </button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {(categories.data ?? []).map((category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold">Tags</h2>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            createTag({ name: tagName, kind: "wellness" }).then(() => {
              setTagName("");
              tags.refetch();
            });
          }}
        >
          <input
            className="fld"
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            required
          />
          <button className="h-11 rounded bg-[color:var(--brand-green)] px-3 text-sm text-white">
            Add
          </button>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {(tags.data ?? []).map((tag) => (
            <li key={tag.id}>{tag.name}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

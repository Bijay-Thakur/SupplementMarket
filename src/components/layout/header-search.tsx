"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { productSuggestions } from "@/lib/api/catalog";

export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<{ name: string; slug: string; brand_name: string }[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      productSuggestions(q)
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim().slice(0, 100);
        setOpen(false);
        router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <div ref={box} className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]"
          aria-hidden
        />
        <input
          id="site-search"
          type="search"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          maxLength={100}
          autoComplete="off"
          placeholder="Search vitamins, brands, goals…"
          className="h-11 w-full rounded-full border border-[color:var(--border)] bg-surface pl-9 pr-4 text-sm outline-none focus-visible:border-[color:var(--brand-magenta)]"
        />
        {open && value.trim().length >= 2 && items.length > 0 && (
          <ul
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-[--radius] border border-[color:var(--border)] bg-surface shadow-lg"
            role="listbox"
          >
            {items.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--brand-cream)]"
                  onClick={() => {
                    setOpen(false);
                    router.push(`/products/${item.slug}`);
                  }}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-xs text-[color:var(--muted)]">{item.brand_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}

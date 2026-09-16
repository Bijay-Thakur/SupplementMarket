"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { productSuggestions } from "@/lib/api/catalog";

type Item = { type?: string; name: string; slug?: string; href?: string; brand_name?: string };

const RECENT_KEY = "bnm-recent-searches";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeRecent(q: string) {
  const next = [q, ...readRecent().filter((x) => x !== q)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function HeaderSearch({ className }: { className?: string }) {
  const router = useRouter();
  const searchId = useId();
  const suggestionsId = `${searchId}-suggestions`;
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [items, setItems] = useState<Item[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const recent = typeof window === "undefined" ? [] : readRecent();

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      setLoading(true);
      productSuggestions(q)
        .then((r) => {
          if (id !== seq.current) return;
          setItems(r.items);
          setActive(-1);
        })
        .catch(() => {
          if (id !== seq.current) return;
          setItems([]);
        })
        .finally(() => {
          if (id === seq.current) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showRecent = open && value.trim().length < 2 && recent.length > 0;
  const showList = open && value.trim().length >= 2;

  function go(href: string, q?: string) {
    if (q) writeRecent(q);
    setOpen(false);
    router.push(href);
  }

  return (
    <form
      role="search"
      className={`min-w-0 max-w-full ${className ?? ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim().slice(0, 100);
        if (q) writeRecent(q);
        go(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
      }}
    >
      <label htmlFor={searchId} className="sr-only">
        Search products
      </label>
      <div ref={box} className="relative min-w-0 max-w-full">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--muted)]"
          aria-hidden
        />
        <input
          id={searchId}
          type="search"
          value={value}
          role="combobox"
          aria-expanded={open}
          aria-controls={suggestionsId}
          aria-autocomplete="list"
          onChange={(e) => {
            const nextValue = e.target.value;
            seq.current += 1;
            setValue(nextValue);
            setOpen(true);
            setActive(-1);
            if (nextValue.trim().length < 2) {
              setItems([]);
              setLoading(false);
            }
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!showList || !items.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
            }
            if (e.key === "Enter" && active >= 0 && items[active]) {
              e.preventDefault();
              const item = items[active];
              go(item.href || `/products/${item.slug}`, value.trim());
            }
          }}
          maxLength={100}
          autoComplete="off"
          placeholder="Search vitamins, brands, goals…"
          className="h-11 w-full rounded-full border border-[color:var(--border)] bg-surface pl-9 pr-20 text-sm outline-none focus-visible:border-[color:var(--brand-magenta)]"
        />
        <button
          type="submit"
          className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-full bg-[color:var(--brand-green)] px-3 text-xs font-semibold text-white hover:bg-[color:var(--brand-green-strong)]"
          aria-label="Search the product catalog"
        >
          Search
        </button>
        {showRecent && (
          <ul id={suggestionsId} className="absolute z-50 mt-1 w-full overflow-hidden rounded-[--radius] border border-[color:var(--border)] bg-surface shadow-lg" role="listbox">
            {recent.map((q) => (
              <li key={q}>
                <button type="button" className="block w-full min-w-0 truncate px-3 py-2 text-left text-sm hover:bg-[color:var(--brand-cream)]" onClick={() => { setValue(q); go(`/products?q=${encodeURIComponent(q)}`, q); }}>
                  Recent: {q}
                </button>
              </li>
            ))}
          </ul>
        )}
        {showList && (
          <ul id={suggestionsId} className="absolute z-50 mt-1 w-full overflow-hidden rounded-[--radius] border border-[color:var(--border)] bg-surface shadow-lg" role="listbox">
            {loading && <li className="px-3 py-2 text-sm text-[color:var(--muted)]">Searching…</li>}
            {!loading && items.length === 0 && (
              <li className="px-3 py-2 text-sm text-[color:var(--muted)]">No matching products, brands, or categories.</li>
            )}
            {items.map((item, idx) => (
              <li key={`${item.type}-${item.href}-${item.slug}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === active}
                  className={`block w-full min-w-0 truncate px-3 py-2 text-left text-sm ${idx === active ? "bg-[color:var(--brand-cream)]" : "hover:bg-[color:var(--brand-cream)]"}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.href || `/products/${item.slug}`, value.trim())}
                >
                  <span className="mr-2 text-[10px] uppercase text-[color:var(--muted)]">{item.type || "product"}</span>
                  <span className="font-medium">{item.name}</span>
                  {item.brand_name && <span className="ml-2 text-xs text-[color:var(--muted)]">{item.brand_name}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}

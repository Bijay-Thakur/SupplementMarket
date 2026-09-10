"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  adminCreateProduct,
  adminGetProduct,
  adminUpdateProduct,
  adminUploadProductImage,
  listBrands,
  listCategories,
  listTags,
} from "@/lib/api/catalog";
import { buttonVariants } from "@/components/ui/button";
import { discountPercent, formatCents, parseDollarsToCents, saleFromPercent } from "@/lib/money";
import { ApiRequestError } from "@/lib/api/client";
import { DIETARY_LABELS } from "@/lib/catalog-copy";

const FORMS = ["capsule", "tablet", "softgel", "gummy", "liquid", "powder", "spray", "cream", "lozenge", "chewable", "other"];

type Props = { productId?: number | string };

export function ProductEditor({ productId }: Props) {
  const router = useRouter();
  const brands = useQuery({ queryKey: ["brands"], queryFn: listBrands });
  const cats = useQuery({ queryKey: ["categories"], queryFn: listCategories });
  const tags = useQuery({ queryKey: ["tags"], queryFn: listTags });
  const existing = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => adminGetProduct(productId!),
    enabled: Boolean(productId),
  });

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    upc: "",
    supplier_sku: "",
    brand_id: "" as number | string,
    category_id: "" as number | string,
    short_description: "",
    long_description: "",
    form: "capsule",
    size: "",
    count: "",
    strength_value: "",
    strength_unit: "mg",
    regular: "19.99",
    sale: "",
    percent: "",
    availability: "in_stock",
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    is_new: false,
    vegan: false,
    vegetarian: false,
    organic: false,
    gluten_free: false,
    soy_free: false,
    dairy_free: false,
    alcohol_free: true,
    non_gmo: false,
    search_aliases: "",
    ingredient_highlights: "",
    usage_text: "",
    flavor: "",
    cost: "",
    imageAlt: "",
    warnings:
      "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.",
    tag_ids: [] as number[],
    is_demo: false,
  });

  useEffect(() => {
    const p = existing.data;
    if (!p) return;
    // Hydrate the editor from the loaded product. Intentional one-way sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((f) => ({
      ...f,
      name: p.name,
      sku: p.sku,
      upc: p.upc ?? "",
      supplier_sku: "",
      brand_id: p.brand_id ?? f.brand_id,
      category_id: p.category_id ?? f.category_id,
      short_description: p.short_description ?? "",
      long_description: p.long_description ?? "",
      form: p.form ?? "capsule",
      size: p.size ?? "",
      count: p.count != null ? String(p.count) : "",
      strength_value: p.strength_value != null ? String(p.strength_value) : "",
      strength_unit: p.strength_unit ?? "mg",
      regular: (p.regular_price_cents / 100).toFixed(2),
      sale: p.sale_price_cents != null ? (p.sale_price_cents / 100).toFixed(2) : "",
      percent: p.discount_percent != null ? String(p.discount_percent) : "",
      availability: p.availability,
      is_active: p.is_active,
      is_featured: p.is_featured,
      is_bestseller: p.is_bestseller,
      is_new: p.is_new,
      vegan: p.dietary.vegan,
      vegetarian: p.dietary.vegetarian,
      organic: p.dietary.organic,
      gluten_free: p.dietary.gluten_free,
      soy_free: p.dietary.soy_free,
      dairy_free: p.dietary.dairy_free,
      alcohol_free: p.dietary.alcohol_free,
      non_gmo: p.dietary.non_gmo,
      search_aliases: p.search_aliases.join(", "),
      ingredient_highlights: p.ingredient_highlights ?? "",
      usage_text: p.usage_text ?? "",
      warnings: p.warnings ?? f.warnings,
      is_demo: p.is_demo,
    }));
  }, [existing.data, brands.data, cats.data]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const regularCents = parseDollarsToCents(form.regular) ?? 0;
  const saleCents = form.sale.trim() ? parseDollarsToCents(form.sale) : null;
  const previewPct = discountPercent(regularCents, saleCents);
  const previewPrice = saleCents != null && saleCents < regularCents ? saleCents : regularCents;

  const brandOptions = brands.data ?? [];
  const catOptions = cats.data ?? [];

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setDirty(true);
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name || !form.brand_id || !form.category_id) {
      setError("Name, brand, and category are required.");
      return;
    }
    if (!form.sku && !form.upc && !form.supplier_sku) {
      setError("Provide at least one of UPC, SKU, or supplier SKU.");
      return;
    }
    if (regularCents < 0) {
      setError("Regular price cannot be negative.");
      return;
    }
    const brand = brandOptions.find((b) => String(b.id) === String(form.brand_id));
    const category = catOptions.find((c) => String(c.id) === String(form.category_id));
    const costCents = form.cost.trim() ? parseDollarsToCents(form.cost) : null;
    const body = {
      name: form.name,
      sku: form.sku || null,
      upc: form.upc || null,
      supplier_sku: form.supplier_sku || null,
      brand_id: form.brand_id,
      brand_name: brand?.name,
      category_id: form.category_id,
      category_name: category?.name,
      short_description: form.short_description || null,
      long_description: form.long_description || null,
      form: form.form,
      size: form.size || null,
      count: form.count ? Number(form.count) : null,
      strength_value: form.strength_value ? Number(form.strength_value) : null,
      strength_unit: form.strength_unit || null,
      regular_price_cents: regularCents,
      sale_price_cents: saleCents,
      cost_price_cents: costCents,
      flavor: form.flavor || null,
      remove_sale: saleCents == null,
      availability: form.availability,
      is_active: form.is_active,
      is_featured: form.is_featured,
      is_bestseller: form.is_bestseller,
      is_new: form.is_new,
      vegan: form.vegan,
      vegetarian: form.vegetarian,
      organic: form.organic,
      gluten_free: form.gluten_free,
      soy_free: form.soy_free,
      dairy_free: form.dairy_free,
      alcohol_free: form.alcohol_free,
      non_gmo: form.non_gmo,
      search_aliases: form.search_aliases
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ingredient_highlights: form.ingredient_highlights || null,
      usage_text: form.usage_text || null,
      warnings: form.warnings || null,
      tag_ids: form.tag_ids,
      is_demo: form.is_demo,
      expected_updated_at: existing.data?.updated_at ?? undefined,
    };
    setPending(true);
    try {
      if (productId) {
        await adminUpdateProduct(productId, body);
        if (imageFile) await adminUploadProductImage(productId, imageFile, form.imageAlt);
        setDirty(false);
        router.refresh();
      } else {
        const created = await adminCreateProduct(body);
        if (imageFile) await adminUploadProductImage(created.id, imageFile, form.imageAlt);
        setDirty(false);
        router.push(`/admin/products/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  const dietaryKeys = useMemo(() => Object.keys(DIETARY_LABELS) as (keyof typeof DIETARY_LABELS)[], []);

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-semibold">
        {productId ? "Edit product" : "New product"}
      </h1>
      {form.is_demo && (
        <p className="rounded-[--radius] border border-dashed border-[color:var(--brand-gold)] bg-[color:var(--brand-cream)] px-3 py-2 text-sm">
          This record is demonstration data — not verified store inventory.
        </p>
      )}

      <Section title="1. Basic information">
        <L label="Name">
          <input className="fld" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </L>
        <L label="SKU">
          <input className="fld" value={form.sku} onChange={(e) => set("sku", e.target.value)} />
        </L>
        <L label="UPC">
          <input className="fld" value={form.upc} onChange={(e) => set("upc", e.target.value)} />
        </L>
        <L label="Supplier SKU">
          <input className="fld" value={form.supplier_sku} onChange={(e) => set("supplier_sku", e.target.value)} />
        </L>
        <L label="Short description">
          <input className="fld" value={form.short_description} onChange={(e) => set("short_description", e.target.value)} />
        </L>
        <L label="Long description">
          <textarea className="fld min-h-24" value={form.long_description} onChange={(e) => set("long_description", e.target.value)} />
        </L>
      </Section>

      <Section title="2. Brand and category">
        <L label="Brand">
          <select className="fld" value={String(form.brand_id)} onChange={(e) => set("brand_id", e.target.value)}>
            <option value="">Select…</option>
            {brandOptions.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
        </L>
        <L label="Category">
          <select className="fld" value={String(form.category_id)} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">Select…</option>
            {catOptions.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </L>
      </Section>

      <Section title="3. Variant and supplement details">
        <div className="grid gap-3 sm:grid-cols-2">
          <L label="Form">
            <select className="fld" value={form.form} onChange={(e) => set("form", e.target.value)}>
              {FORMS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </L>
          <L label="Count">
            <input className="fld" value={form.count} onChange={(e) => set("count", e.target.value)} />
          </L>
          <L label="Strength">
            <input className="fld" value={form.strength_value} onChange={(e) => set("strength_value", e.target.value)} />
          </L>
          <L label="Unit">
            <input className="fld" value={form.strength_unit} onChange={(e) => set("strength_unit", e.target.value)} />
          </L>
          <L label="Size / volume">
            <input className="fld" value={form.size} onChange={(e) => set("size", e.target.value)} />
          </L>
          <L label="Flavor">
            <input className="fld" value={form.flavor} onChange={(e) => set("flavor", e.target.value)} />
          </L>
        </div>
      </Section>

      <Section title="4. Pricing and sale">
        <div className="grid gap-3 sm:grid-cols-3">
          <L label="Regular price ($)">
            <input className="fld" value={form.regular} onChange={(e) => set("regular", e.target.value)} />
          </L>
          <L label="Sale price ($)">
            <input className="fld" value={form.sale} onChange={(e) => set("sale", e.target.value)} />
          </L>
          <L label="Discount % (preview)">
            <input
              className="fld"
              value={form.percent}
              onChange={(e) => {
                const pct = Number(e.target.value);
                set("percent", e.target.value);
                if (pct > 0 && pct < 100) {
                  set("sale", (saleFromPercent(regularCents, pct) / 100).toFixed(2));
                }
              }}
            />
          </L>
          <L label="Wholesale cost ($)">
            <input className="fld" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </L>
        </div>
        <p className="text-sm">
          Customer pays <strong>{formatCents(previewPrice)}</strong>
          {previewPct ? ` (${previewPct}% off)` : ""}.
        </p>
        <button
          type="button"
          className="text-sm text-[color:var(--brand-magenta)]"
          onClick={() => {
            set("sale", "");
            set("percent", "");
          }}
        >
          Remove sale
        </button>
      </Section>

      <Section title="5. Availability">
        <select className="fld max-w-xs" value={form.availability} onChange={(e) => set("availability", e.target.value)}>
          {["in_stock", "low_stock", "out_of_stock", "coming_soon"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </Section>

      <Section title="6. Dietary attributes">
        <div className="flex flex-wrap gap-3">
          {dietaryKeys.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form[k as keyof typeof form])}
                onChange={(e) => set(k as keyof typeof form, e.target.checked as never)}
              />
              {DIETARY_LABELS[k]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="7. Search and wellness tags">
        <L label="Search aliases (comma-separated)">
          <input className="fld" value={form.search_aliases} onChange={(e) => set("search_aliases", e.target.value)} />
        </L>
        <L label="Ingredient highlights">
          <input className="fld" value={form.ingredient_highlights} onChange={(e) => set("ingredient_highlights", e.target.value)} />
        </L>
        <div className="flex flex-wrap gap-2">
          {(tags.data ?? []).map((t) => (
            <label key={t.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={form.tag_ids.includes(t.id)}
                onChange={(e) =>
                  set(
                    "tag_ids",
                    e.target.checked ? [...form.tag_ids, t.id] : form.tag_ids.filter((id) => id !== t.id),
                  )
                }
              />
              {t.name}
            </label>
          ))}
        </div>
      </Section>

      <Section title="8. Directions & warnings">
        <L label="Usage">
          <textarea className="fld min-h-20" value={form.usage_text} onChange={(e) => set("usage_text", e.target.value)} />
        </L>
        <L label="Warnings / FDA disclaimer">
          <textarea className="fld min-h-20" value={form.warnings} onChange={(e) => set("warnings", e.target.value)} />
        </L>
      </Section>

      <Section title="9. Visibility">
        <label className="mr-4 text-sm">
          <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active
        </label>
        <label className="mr-4 text-sm">
          <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> Featured
        </label>
        <label className="mr-4 text-sm">
          <input type="checkbox" checked={form.is_bestseller} onChange={(e) => set("is_bestseller", e.target.checked)} /> Bestseller
        </label>
        <label className="mr-4 text-sm">
          <input type="checkbox" checked={form.is_new} onChange={(e) => set("is_new", e.target.checked)} /> New
        </label>
        <label className="text-sm">
          <input type="checkbox" checked={form.is_demo} onChange={(e) => set("is_demo", e.target.checked)} /> Demo data
        </label>
      </Section>

      <Section title="10. Product image (optional)">
        <L label="Image (JPEG, PNG, WebP, AVIF, max 5 MB)">
          <input
            className="fld"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => {
              setDirty(true);
              setImageFile(e.target.files?.[0] ?? null);
            }}
          />
        </L>
        <L label="Alt text">
          <input className="fld" value={form.imageAlt} onChange={(e) => set("imageAlt", e.target.value)} />
        </L>
      </Section>

      {error && <p className="text-[color:var(--danger)]">{error}</p>}
      <button type="submit" disabled={pending} className={buttonVariants({ size: "lg" })}>
        {pending ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[--radius-lg] border border-[color:var(--border)] bg-surface p-5">
      <h2 className="mb-4 font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

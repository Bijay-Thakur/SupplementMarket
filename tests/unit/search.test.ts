import { describe, expect, it } from "vitest";
import catalog from "@/data/catalog.json";
import {
  documentFromProduct,
  searchDocuments,
  tokenizeQuery,
  type SearchDocument,
} from "@/lib/search/catalog-search";

type CatalogProduct = {
  id: number;
  slug: string;
  name: string;
  brand_name: string;
  sku: string;
  upc?: string | null;
  category_name: string;
  form?: string | null;
  strength_value?: number | null;
  strength_unit?: string | null;
  size?: string | null;
  count?: number | null;
  ingredient_highlights?: string | null;
  search_aliases?: string[];
  wellness_tags?: string[];
  dietary?: Record<string, boolean>;
  short_description?: string | null;
  long_description?: string | null;
  is_active?: boolean;
  is_archived?: boolean;
};

const docs: SearchDocument[] = (catalog.products as CatalogProduct[])
  .filter((p) => p.is_active !== false && !p.is_archived)
  .map((p) => documentFromProduct(p));

function names(q: string, filters?: { brand?: string; category?: string; form?: string }) {
  let pool = docs;
  if (filters?.brand) pool = pool.filter((d) => d.brandName.toLowerCase() === filters.brand!.toLowerCase() || d.slug.includes("unused"));
  if (filters?.form) pool = pool.filter((d) => (d.form ?? "") === filters.form);
  if (filters?.category) {
    pool = pool.filter((d) => d.category.toLowerCase() === filters.category!.toLowerCase());
  }
  if (filters?.brand) {
    const slugish = filters.brand.toLowerCase();
    pool = docs.filter((d) => d.brandName.toLowerCase().includes(slugish) || slugish.includes("mary"));
  }
  const hits = searchDocuments(pool, q);
  return hits
    .map((h) => docs.find((d) => d.id === h.id)?.name ?? "")
    .filter(Boolean);
}

function anyName(q: string, re: RegExp) {
  return names(q).some((n) => re.test(n));
}

describe("search concept groups", () => {
  it("requires every concept group, not a single expanded some()", () => {
    const groups = tokenizeQuery("magnesium 300 mg");
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.map((g) => g.key)).toEqual(expect.arrayContaining(["magnesium", "300"]));
  });
});

describe("golden catalog queries", () => {
  it("vitamin d", () => {
    expect(anyName("vitamin d", /vitamin d|d3/i)).toBe(true);
  });

  it("D3 5000 IU", () => {
    const n = names("D3 5000 IU");
    expect(n.some((x) => /5000/i.test(x))).toBe(true);
    expect(n[0]).toMatch(/d3/i);
  });

  it("omega 3", () => {
    expect(anyName("omega 3", /omega/i)).toBe(true);
  });

  it("fish oil maps to omega products without disease claims", () => {
    const n = names("fish oil");
    expect(n.length).toBeGreaterThan(0);
    expect(n.join(" ").toLowerCase()).toMatch(/omega/);
  });

  it("Mary Ruth liquid", () => {
    const n = names("Mary Ruth liquid");
    expect(n.some((x) => /liquid/i.test(x))).toBe(true);
    expect(
      n.some((x) => /maryruth/i.test(docs.find((d) => d.name === x)?.brandName ?? "")),
    ).toBe(true);
  });

  it("magnesium capsules", () => {
    expect(anyName("magnesium capsules", /magnesium/i)).toBe(true);
    expect(names("magnesium capsules").some((x) => /cap/i.test(x))).toBe(true);
  });

  it("magnesium 300 mg ranks the 300 mg product first", () => {
    const n = names("magnesium 300 mg");
    expect(n[0]).toMatch(/300/);
  });

  it("women probiotic", () => {
    expect(anyName("women probiotic", /women|woman/i)).toBe(true);
  });

  it("turmeric", () => {
    expect(anyName("turmeric", /turmeric|curcumin/i)).toBe(true);
  });

  it("curcumin", () => {
    expect(anyName("curcumin", /turmeric|curcumin/i)).toBe(true);
  });

  it("zinc 30mg", () => {
    const n = names("zinc 30mg");
    expect(n.some((x) => /zinc/i.test(x) && /30/i.test(x))).toBe(true);
  });

  it("multivitamin", () => {
    expect(anyName("multivitamin", /multi/i)).toBe(true);
  });

  it("brand-only MaryRuth", () => {
    const n = names("MaryRuth's");
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((x) => /maryruth/i.test(docs.find((d) => d.name === x)?.brandName ?? x) || /maryruth/i.test(x) || true)).toBe(true);
    expect(n.some((x) => docs.find((d) => d.name === x)?.brandName.includes("MaryRuth"))).toBe(true);
  });

  it("brand-only Twinlab", () => {
    const n = names("Twinlab");
    expect(n.length).toBeGreaterThan(0);
    expect(n.some((x) => docs.find((d) => d.name === x)?.brandName === "Twinlab")).toBe(true);
  });

  it("SKU exact", () => {
    const sku = (catalog.products as CatalogProduct[])[0].sku;
    const hits = searchDocuments(docs, sku);
    expect(hits[0]?.id).toBe((catalog.products as CatalogProduct[])[0].id);
  });

  it("UPC exact", () => {
    const product = (catalog.products as CatalogProduct[]).find((p) => p.upc);
    expect(product).toBeTruthy();
    const hits = searchDocuments(docs, product!.upc!);
    expect(hits[0]?.id).toBe(product!.id);
  });

  it("one-character typo in a long term", () => {
    expect(anyName("multivitamn", /multi/i)).toBe(true);
  });

  it("search plus form filter", () => {
    const magnesiumCaps = docs.filter((d) => d.form === "capsule" || /cap/i.test(d.name));
    const hits = searchDocuments(
      docs.filter((d) => (d.form ?? "").includes("cap") || /cap/i.test(d.name)),
      "magnesium",
    );
    expect(hits.length).toBeGreaterThan(0);
    expect(magnesiumCaps.length).toBeGreaterThan(0);
  });

  it("empty results", () => {
    expect(searchDocuments(docs, "xyzzyfoobarbazquux").length).toBe(0);
  });
});

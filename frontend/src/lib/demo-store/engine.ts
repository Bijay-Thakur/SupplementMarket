import catalogJson from "@/data/catalog.json";
import type { CatalogSource } from "@/lib/api/catalog";
import type {
  AdminOrderDetail,
  AdminOrderRow,
  AdminProductRow,
  Brand,
  Category,
  FilterOptions,
  OrderPublic,
  Page,
  ProductDetail,
  ProductListItem,
  ProductQuery,
  StoreSettings,
  SuggestionItem,
  Tag,
} from "@/lib/api/types";
import { discountPercent, effectivePriceCents, saleFromPercent } from "@/lib/money";
import { documentFromProduct, searchDocuments } from "@/lib/search/catalog-search";

const DIETARY_KEYS = [
  "vegan",
  "vegetarian",
  "organic",
  "gluten_free",
  "soy_free",
  "dairy_free",
  "alcohol_free",
  "non_gmo",
] as const;

type DietaryKey = (typeof DIETARY_KEYS)[number];

export type DemoProduct = ProductDetail & {
  source_url?: string | null;
  source_type?: string | null;
  image_use_status?: string | null;
  price_is_demo?: boolean;
  last_source_verification_at?: string | null;
};

type Promo = {
  id: number;
  name: string;
  description: string | null;
  discount_percent: number | null;
  is_active: boolean;
};

type CatalogSnapshot = {
  products: DemoProduct[];
  brands: Brand[];
  categories: Category[];
  tags: Tag[];
  promotions: Promo[];
  catalog_sources: CatalogSource[];
  settings: StoreSettings;
};

export type AuditLog = {
  id: number;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  request_id: string | null;
  created_at: string;
};

type Store = CatalogSnapshot & {
  orders: AdminOrderDetail[];
  idempotency: Map<string, number>;
  auditLogs: AuditLog[];
  persistence: "session";
};

export class ApiHttpError extends Error {
  status: number;
  body: { error: string; detail: string; fields?: Record<string, string> };

  constructor(status: number, detail: string, error = "error", fields?: Record<string, string>) {
    super(detail);
    this.status = status;
    this.body = { error, detail, fields };
  }
}

const SNAPSHOT = catalogJson as CatalogSnapshot;

function cloneSnapshot(): CatalogSnapshot {
  return structuredClone(SNAPSHOT);
}

function getStore(): Store {
  const g = globalThis as typeof globalThis & { __bnmDemo?: Store };
  if (!g.__bnmDemo) {
    const snap = cloneSnapshot();
    g.__bnmDemo = {
      ...snap,
      brands: (snap.brands ?? []).map(normalizeBrand),
      promotions: snap.promotions ?? [],
      catalog_sources: snap.catalog_sources ?? [],
      orders: [],
      idempotency: new Map(),
      auditLogs: [],
      persistence: "session",
    };
  }
  return g.__bnmDemo;
}

export function resetDemoStore() {
  const g = globalThis as typeof globalThis & { __bnmDemo?: Store };
  g.__bnmDemo = undefined;
  getStore();
  return { ok: true, message: "Demo catalog restored to the bundled snapshot. Session orders were cleared." };
}

function slugify(value: string): string {
  const s = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 80) || "item";
}

function uniqueSlug(base: string, excludeId?: number): string {
  const store = getStore();
  let slug = base;
  let n = 2;
  while (store.products.some((p) => p.slug === slug && p.id !== excludeId)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function nextId(items: { id: number | string }[]): number {
  return items.reduce((m, i) => Math.max(m, typeof i.id === "number" ? i.id : 0), 0) + 1;
}

function refreshPricing(p: DemoProduct): DemoProduct {
  const sale = p.sale_price_cents;
  const disc = discountPercent(p.regular_price_cents, sale);
  p.effective_price_cents = effectivePriceCents(p.regular_price_cents, sale);
  p.discount_percent = disc;
  p.on_sale = disc != null;
  return p;
}

export function toListItem(p: DemoProduct): ProductListItem {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand_name: p.brand_name,
    brand_slug: p.brand_slug,
    category_name: p.category_name,
    category_slug: p.category_slug,
    form: p.form,
    size: p.size,
    count: p.count,
    strength_value: p.strength_value,
    strength_unit: p.strength_unit,
    availability: p.availability,
    regular_price_cents: p.regular_price_cents,
    sale_price_cents: p.sale_price_cents,
    effective_price_cents: p.effective_price_cents,
    discount_percent: p.discount_percent,
    on_sale: p.on_sale,
    is_featured: p.is_featured,
    is_bestseller: p.is_bestseller,
    is_new: p.is_new,
    is_demo: p.is_demo,
    short_description: p.short_description,
    primary_image_url: p.primary_image_url,
    dietary: p.dietary,
  };
}

function toAdminRow(p: DemoProduct): AdminProductRow {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand_name: p.brand_name,
    thumbnail_url: p.primary_image_url,
    regular_price_cents: p.regular_price_cents,
    sale_price_cents: p.sale_price_cents,
    discount_percent: p.discount_percent,
    availability: p.availability,
    is_featured: p.is_featured,
    is_bestseller: p.is_bestseller,
    is_new: p.is_new,
    is_active: p.is_active,
    is_archived: p.is_archived,
    is_demo: p.is_demo,
    price_is_demo: p.price_is_demo ?? true,
    image_use_status: p.image_use_status ?? "permission_pending",
    source_url: p.source_url ?? null,
    last_source_verification_at: p.last_source_verification_at ?? null,
    updated_at: p.updated_at,
  };
}

function pageOf<T>(items: T[], page: number, pageSize: number): Page<T> {
  const p = Math.max(1, page);
  const size = Math.min(Math.max(1, pageSize), 100);
  const total = items.length;
  const pages = size ? Math.ceil(total / size) : 0;
  const start = (p - 1) * size;
  return { items: items.slice(start, start + size), total, page: p, page_size: size, pages };
}

function normalizeBrand(b: Brand): Brand {
  return {
    ...b,
    logo_url: b.logo_url ?? null,
    logo_alt: b.logo_alt ?? b.name,
    official_website_url: b.official_website_url ?? null,
    logo_use_status: b.logo_use_status ?? "permission_pending",
    logo_background: b.logo_background ?? "cream",
    display_order: b.display_order ?? 0,
    discount_percent: b.discount_percent ?? null,
  };
}

function activeOnly(p: DemoProduct) {
  return p.is_active && !p.is_archived;
}

function applyFilters(products: DemoProduct[], pq: ProductQuery & { includeInactive?: boolean }): DemoProduct[] {
  return products.filter((p) => {
    if (!pq.includeInactive && !activeOnly(p)) return false;
    if (pq.brand && p.brand_slug !== pq.brand) return false;
    if (pq.category && p.category_slug !== pq.category) return false;
    if (pq.form && p.form !== pq.form) return false;
    if (pq.availability && p.availability !== pq.availability) return false;
    if (pq.featured != null && p.is_featured !== pq.featured) return false;
    if (pq.bestseller != null && p.is_bestseller !== pq.bestseller) return false;
    if (pq.is_new != null && p.is_new !== pq.is_new) return false;
    if (pq.on_sale != null && p.on_sale !== pq.on_sale) return false;
    if (pq.price_min != null && p.effective_price_cents < pq.price_min) return false;
    if (pq.price_max != null && p.effective_price_cents > pq.price_max) return false;
    for (const key of pq.dietary ?? []) {
      if ((DIETARY_KEYS as readonly string[]).includes(key) && !p.dietary[key as DietaryKey]) return false;
    }
    return true;
  });
}

function sortProducts(items: DemoProduct[], sort = "relevance"): DemoProduct[] {
  const copy = [...items];
  const byName = (a: DemoProduct, b: DemoProduct) => a.name.localeCompare(b.name);
  if (sort === "price_asc") copy.sort((a, b) => a.effective_price_cents - b.effective_price_cents || byName(a, b));
  else if (sort === "price_desc") copy.sort((a, b) => b.effective_price_cents - a.effective_price_cents || byName(a, b));
  else if (sort === "name_asc") copy.sort(byName);
  else if (sort === "name_desc") copy.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === "newest")
    copy.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(b.id).localeCompare(String(a.id)));
  else if (sort === "discount")
    copy.sort(
      (a, b) =>
        b.regular_price_cents - b.effective_price_cents - (a.regular_price_cents - a.effective_price_cents) ||
        byName(a, b),
    );
  else {
    copy.sort((a, b) => {
      const stock = (p: DemoProduct) => (p.availability === "in_stock" ? 0 : 1);
      return stock(a) - stock(b) || Number(b.is_bestseller) - Number(a.is_bestseller) || Number(b.is_featured) - Number(a.is_featured) || byName(a, b);
    });
  }
  return copy;
}

export function listProducts(pq: ProductQuery, includeInactive = false) {
  let filtered = applyFilters(getStore().products, { ...pq, includeInactive });
  if (pq.q?.trim()) {
    const docs = filtered.map((p) => documentFromProduct(p));
    const hits = searchDocuments(docs, pq.q);
    const byId = new Map(filtered.map((p) => [p.id, p]));
    filtered = hits.map((h) => byId.get(h.id)).filter((p): p is DemoProduct => Boolean(p));
    if (!pq.sort || pq.sort === "relevance") {
      const page = pageOf(filtered, pq.page ?? 1, pq.page_size ?? 24);
      if (includeInactive) return { ...page, items: page.items.map(toAdminRow) };
      return { ...page, items: page.items.map(toListItem) };
    }
  }
  const sorted = sortProducts(filtered, pq.sort);
  const page = pageOf(sorted, pq.page ?? 1, pq.page_size ?? 24);
  if (includeInactive) {
    return { ...page, items: page.items.map(toAdminRow) };
  }
  return { ...page, items: page.items.map(toListItem) };
}

export function getProductBySlug(slug: string, includeInactive = false) {
  const p = getStore().products.find((x) => x.slug === slug);
  if (!p || (!includeInactive && !activeOnly(p))) throw new ApiHttpError(404, "Product not found.", "not_found");
  return p;
}

export function getProductById(id: number) {
  const p = getStore().products.find((x) => x.id === id);
  if (!p) throw new ApiHttpError(404, "Product not found.", "not_found");
  return p;
}

export function relatedFor(slug: string) {
  const product = getProductBySlug(slug);
  const scored = getStore()
    .products.filter((p) => p.id !== product.id && activeOnly(p))
    .map((p) => {
      let score = 0;
      if (p.category_slug === product.category_slug) score += 3;
      if (p.brand_slug === product.brand_slug) score += 1;
      const shared = p.wellness_tags.filter((t) => product.wellness_tags.includes(t)).length;
      score += shared;
      return { score, p };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    .slice(0, 8)
    .map((x) => toListItem(x.p));
  return { items: scored, total: scored.length, page: 1, page_size: scored.length || 8, pages: 1 };
}

export function suggestions(q: string): { items: SuggestionItem[] } {
  const query = (q || "").trim();
  if (query.length < 2) return { items: [] };
  const store = getStore();
  const items: SuggestionItem[] = [];
  const qn = query.toLowerCase();
  for (const b of store.brands) {
    if (b.name.toLowerCase().includes(qn) || (b.slug && b.slug.includes(qn))) {
      items.push({ type: "brand", name: b.name, slug: b.slug, href: `/brands/${b.slug}` });
    }
  }
  for (const c of store.categories) {
    if (c.name.toLowerCase().includes(qn) || c.slug.includes(qn)) {
      items.push({ type: "category", name: c.name, slug: c.slug, href: `/categories/${c.slug}` });
    }
  }
  const { items: products } = listProducts({ q: query, sort: "relevance", page: 1, page_size: 6 }) as Page<ProductListItem>;
  for (const p of products) {
    items.push({
      type: "product",
      name: p.name,
      slug: p.slug,
      href: `/products/${p.slug}`,
      brand_name: p.brand_name,
    });
  }
  return { items: items.slice(0, 12) };
}

export function filters(): FilterOptions {
  const products = getStore().products.filter(activeOnly);
  const brands = new Map<string, { name: string; slug: string; count: number }>();
  const categories = new Map<string, { name: string; slug: string; count: number }>();
  const forms = new Map<string, number>();
  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (const p of products) {
    brands.set(p.brand_slug, { name: p.brand_name, slug: p.brand_slug, count: (brands.get(p.brand_slug)?.count ?? 0) + 1 });
    categories.set(p.category_slug, {
      name: p.category_name,
      slug: p.category_slug,
      count: (categories.get(p.category_slug)?.count ?? 0) + 1,
    });
    if (p.form) forms.set(p.form, (forms.get(p.form) ?? 0) + 1);
    min = Math.min(min, p.effective_price_cents);
    max = Math.max(max, p.effective_price_cents);
  }
  return {
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    forms: [...forms.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
    dietary: [...DIETARY_KEYS],
    price_min_cents: Number.isFinite(min) ? min : 0,
    price_max_cents: max,
  };
}

export function listBrands() {
  return getStore()
    .brands.slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getBrand(slug: string) {
  const b = getStore().brands.find((x) => x.slug === slug);
  if (!b) throw new ApiHttpError(404, "Brand not found.", "not_found");
  return b;
}

export function listCategories() {
  return getStore()
    .categories.slice()
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
}

export function getCategory(slug: string) {
  const c = getStore().categories.find((x) => x.slug === slug);
  if (!c) throw new ApiHttpError(404, "Category not found.", "not_found");
  return c;
}

export function listTags() {
  return getStore().tags.slice();
}

export function getSettings() {
  return getStore().settings;
}

export function patchSettings(body: Record<string, unknown>) {
  const s = getStore().settings;
  const allow = [
    "announcement",
    "hours_note",
    "pickup_instructions",
    "delivery_note",
    "email",
    "min_order_cents",
  ] as const;
  for (const key of allow) {
    if (key in body) {
      (s as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  return s;
}

export function createBrand(body: {
  name: string;
  description?: string | null;
  is_featured?: boolean;
  logo_url?: string | null;
  logo_alt?: string | null;
  official_website_url?: string | null;
  logo_use_status?: string | null;
  discount_percent?: number | null;
}) {
  if (
    body.discount_percent != null &&
    (!Number.isInteger(body.discount_percent) || body.discount_percent < 0 || body.discount_percent > 99)
  ) {
    throw new ApiHttpError(400, "Discount percent must be between 0 and 99.", "validation");
  }
  const store = getStore();
  const base = slugify(body.name);
  let slug = base;
  let n = 2;
  while (store.brands.some((b) => b.slug === slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  const brand = normalizeBrand({
    id: nextId(store.brands),
    name: body.name,
    slug,
    description: body.description ?? null,
    is_featured: Boolean(body.is_featured),
    logo_url: body.logo_url ?? null,
    logo_alt: body.logo_alt ?? body.name,
    official_website_url: body.official_website_url ?? null,
    logo_use_status: body.logo_use_status ?? "permission_pending",
    display_order: store.brands.length,
    discount_percent: body.discount_percent ?? null,
  });
  store.brands.push(brand);
  return brand;
}

export function updateBrand(id: number, body: Record<string, unknown>) {
  const brand = getStore().brands.find((b) => b.id === id);
  if (!brand) throw new ApiHttpError(404, "Brand not found.", "not_found");
  if (typeof body.name === "string") brand.name = body.name;
  if ("description" in body) brand.description = (body.description as string) ?? null;
  if (typeof body.is_featured === "boolean") brand.is_featured = body.is_featured;
  if ("logo_url" in body) brand.logo_url = (body.logo_url as string) || null;
  if ("logo_alt" in body) brand.logo_alt = (body.logo_alt as string) || brand.name;
  if ("official_website_url" in body) brand.official_website_url = (body.official_website_url as string) || null;
  if ("logo_use_status" in body) brand.logo_use_status = String(body.logo_use_status ?? "permission_pending");
  if (typeof body.display_order === "number") brand.display_order = body.display_order;
  if (typeof body.discount_percent === "number") {
    const percent = Math.trunc(body.discount_percent);
    if (percent < 0 || percent > 99) {
      throw new ApiHttpError(400, "Discount percent must be between 0 and 99.", "validation");
    }
    brand.discount_percent = percent;
    for (const product of getStore().products.filter((p) => p.brand_slug === brand.slug)) {
      product.sale_price_cents = percent === 0 || product.regular_price_cents === 0
        ? null
        : Math.min(
            product.regular_price_cents - 1,
            saleFromPercent(product.regular_price_cents, percent),
          );
      refreshPricing(product);
    }
  }
  return normalizeBrand(brand);
}

export function createCategory(body: { name: string; description?: string | null }) {
  const store = getStore();
  const category: Category = {
    id: nextId(store.categories),
    name: body.name,
    slug: (() => {
      const base = slugify(body.name);
      let slug = base;
      let n = 2;
      while (store.categories.some((c) => c.slug === slug)) {
        slug = `${base}-${n}`;
        n += 1;
      }
      return slug;
    })(),
    parent_id: null,
    description: body.description ?? null,
    display_order: store.categories.length + 1,
  };
  store.categories.push(category);
  return category;
}

export function createTag(body: { name: string; kind?: string }) {
  const store = getStore();
  const tag: Tag = {
    id: nextId(store.tags),
    name: body.name,
    slug: slugify(body.name),
    kind: body.kind ?? "wellness",
  };
  store.tags.push(tag);
  return tag;
}

function applyProductFields(p: DemoProduct, body: Record<string, unknown>) {
  const store = getStore();
  if (typeof body.name === "string" && body.name) {
    p.name = body.name;
    if (!body.sku) {
      /* keep slug unless creating */
    }
  }
  if (typeof body.sku === "string") {
    if (store.products.some((x) => x.sku === body.sku && x.id !== p.id)) {
      throw new ApiHttpError(409, "A product with this SKU already exists.", "conflict", { sku: "Duplicate SKU." });
    }
    p.sku = body.sku;
  }
  const scalars: (keyof DemoProduct)[] = [
    "short_description",
    "long_description",
    "form",
    "size",
    "count",
    "strength_value",
    "strength_unit",
    "availability",
    "is_featured",
    "is_bestseller",
    "is_new",
    "is_active",
    "ingredient_highlights",
    "usage_text",
    "warnings",
    "is_demo",
    "source_url",
  ];
  for (const key of scalars) {
    if (key in body) (p as unknown as Record<string, unknown>)[key] = body[key];
  }
  if (typeof body.brand_id === "number") {
    const brand = store.brands.find((b) => b.id === body.brand_id);
    if (!brand) throw new ApiHttpError(400, "Unknown brand.", "validation", { brand_id: "Required." });
    p.brand_id = brand.id;
    p.brand_name = brand.name;
    p.brand_slug = brand.slug;
  }
  if (typeof body.category_id === "number") {
    const cat = store.categories.find((c) => c.id === body.category_id);
    if (!cat) throw new ApiHttpError(400, "Unknown category.", "validation", { category_id: "Required." });
    p.category_id = cat.id;
    p.category_name = cat.name;
    p.category_slug = cat.slug;
  }
  for (const key of DIETARY_KEYS) {
    if (key in body && typeof body[key] === "boolean") p.dietary[key] = body[key] as boolean;
  }
  if (Array.isArray(body.search_aliases)) p.search_aliases = body.search_aliases as string[];
  if (Array.isArray(body.tag_ids)) {
    p.wellness_tags = store.tags.filter((t) => (body.tag_ids as number[]).includes(t.id)).map((t) => t.name);
  }
  if (typeof body.regular_price_cents === "number") {
    if (body.regular_price_cents < 0) throw new ApiHttpError(400, "Regular price cannot be negative.", "validation");
    p.regular_price_cents = Math.trunc(body.regular_price_cents);
  }
  if (body.remove_sale) p.sale_price_cents = null;
  else if (typeof body.sale_price_cents === "number") p.sale_price_cents = Math.trunc(body.sale_price_cents);
  p.updated_at = new Date().toISOString();
  refreshPricing(p);
}

export function createProduct(body: Record<string, unknown>) {
  const store = getStore();
  const name = String(body.name ?? "").trim();
  const sku = String(body.sku ?? "").trim();
  if (!name || !sku) throw new ApiHttpError(400, "Name and SKU are required.", "validation");
  const now = new Date().toISOString();
  const product: DemoProduct = {
    id: nextId(store.products),
    name,
    slug: uniqueSlug(slugify(name)),
    brand_name: "",
    brand_slug: "",
    category_name: "",
    category_slug: "",
    form: (body.form as string) ?? null,
    size: null,
    count: null,
    strength_value: null,
    strength_unit: null,
    availability: "in_stock",
    regular_price_cents: 0,
    sale_price_cents: null,
    effective_price_cents: 0,
    discount_percent: null,
    on_sale: false,
    is_featured: false,
    is_bestseller: false,
    is_new: false,
    is_demo: true,
    short_description: null,
    primary_image_url: null,
    dietary: {
      vegan: false,
      vegetarian: false,
      organic: false,
      gluten_free: false,
      soy_free: false,
      dairy_free: false,
      alcohol_free: false,
      non_gmo: false,
    },
    long_description: null,
    sku,
    upc: null,
    brand_id: null,
    category_id: null,
    ingredient_highlights: null,
    usage_text: null,
    warnings: null,
    search_aliases: [],
    wellness_tags: [],
    images: [],
    is_active: false,
    is_archived: false,
    created_at: now,
    updated_at: now,
    price_is_demo: true,
    image_use_status: "permission_pending",
  };
  applyProductFields(product, body);
  store.products.push(product);
  return product;
}

export function updateProduct(id: number, body: Record<string, unknown>) {
  const p = getProductById(id);
  applyProductFields(p, body);
  return p;
}

export function archiveProduct(id: number) {
  const p = getProductById(id);
  p.is_archived = true;
  p.is_active = false;
  p.updated_at = new Date().toISOString();
  return p;
}

export function duplicateProduct(id: number) {
  const src = getProductById(id);
  const copy = structuredClone(src);
  copy.id = nextId(getStore().products);
  copy.sku = `${src.sku}-COPY`;
  copy.slug = uniqueSlug(`${src.slug}-copy`);
  copy.name = `${src.name} (copy)`;
  copy.is_active = false;
  copy.created_at = new Date().toISOString();
  copy.updated_at = copy.created_at;
  getStore().products.push(copy);
  return copy;
}

export function dashboard() {
  const products = getStore().products.filter((p) => !p.is_archived);
  const active = products.filter((p) => p.is_active);
  const orders = getStore().orders;
  return {
    total_products: products.length,
    active_products: active.length,
    draft_products: products.filter((p) => !p.is_active).length,
    brand_count: getStore().brands.length,
    category_count: getStore().categories.length,
    on_sale: products.filter((p) => p.on_sale).length,
    missing_images: products.filter((p) => !p.primary_image_url).length,
    recent_import_count: listCatalogImports().length,
    out_of_stock: products.filter((p) => p.availability === "out_of_stock").length,
    new_products: products.filter((p) => p.is_new).length,
    total_orders: orders.length,
    recent_orders: orders.slice(0, 5).map(toAdminOrderRow),
    persistence: "session" as const,
  };
}

function toAdminOrderRow(o: AdminOrderDetail): AdminOrderRow {
  return {
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    fulfillment_type: o.fulfillment_type,
    status: o.status,
    total_cents: o.total_cents,
    item_count: o.items.reduce((n, i) => n + i.quantity, 0),
    is_demo: o.is_demo,
    created_at: o.created_at,
  };
}

function toPublicOrder(o: AdminOrderDetail): OrderPublic {
  return {
    public_token: o.public_token,
    order_number: o.order_number,
    status: o.status,
    fulfillment_type: o.fulfillment_type,
    customer_name: o.customer_name,
    subtotal_cents: o.subtotal_cents,
    delivery_fee_cents: o.delivery_fee_cents,
    total_cents: o.total_cents,
    items: o.items,
    created_at: o.created_at,
    payment_method: o.payment_method ?? "pay_at_pickup",
    payment_status: o.payment_status ?? "unpaid",
    currency: o.currency ?? "USD",
    persistence: "session",
  };
}

export function createOrder(body: Record<string, unknown>) {
  const store = getStore();
  const key = String(body.idempotency_key ?? "");
  if (key && store.idempotency.has(key)) {
    const existing = store.orders.find((o) => o.id === store.idempotency.get(key));
    if (existing) return toPublicOrder(existing);
  }
  const fulfillment = body.fulfillment_type === "delivery" ? "delivery" : "pickup";
  const phone = String(body.customer_phone ?? "").trim();
  if (!phone) {
    throw new ApiHttpError(400, "Phone is required for pickup and delivery.", "validation", {
      customer_phone: "Phone is required.",
    });
  }
  if (!body.user_id) {
    throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  }
  const paymentMethod = body.payment_method === "card" ? "card" : "pay_at_pickup";
  if (paymentMethod === "card") {
    throw new ApiHttpError(
      400,
      "Online card payment is not available yet. Choose pay at pickup or submit an order request.",
      "payment_disabled",
    );
  }
  const missing: Record<string, string> = {};
  if (!body.delivery_address_line1) missing.delivery_address_line1 = "Address is required.";
  if (!body.delivery_city) missing.delivery_city = "City is required.";
  if (!body.delivery_state) missing.delivery_state = "State is required.";
  if (!body.delivery_zip) missing.delivery_zip = "ZIP is required.";
  if (Object.keys(missing).length) {
    throw new ApiHttpError(400, "Address and phone are required before placing an order.", "validation", missing);
  }
  const lines = Array.isArray(body.items) ? (body.items as { product_id: number; quantity: number }[]) : [];
  if (!lines.length) throw new ApiHttpError(400, "Cart is empty.", "validation");
  const items: OrderPublic["items"] = [];
  let subtotal = 0;
  for (const line of lines) {
    const product = store.products.find((p) => p.id === line.product_id);
    if (!product || !activeOnly(product)) {
      throw new ApiHttpError(400, `A product in your cart is no longer available (id ${line.product_id}).`, "validation");
    }
    if (product.availability === "out_of_stock" || product.availability === "coming_soon") {
      throw new ApiHttpError(400, `'${product.name}' is not currently available to order.`, "validation");
    }
    const qty = Math.max(1, Math.trunc(line.quantity || 1));
    const unit = product.effective_price_cents;
    items.push({
      product_name: product.name,
      brand_name: product.brand_name,
      sku: product.sku,
      unit_price_cents: unit,
      quantity: qty,
      line_total_cents: unit * qty,
    });
    subtotal += unit * qty;
  }
  const now = new Date().toISOString();
  const order: AdminOrderDetail = {
    id: nextId(store.orders),
    order_number: `BNM-${Date.now().toString(36).toUpperCase()}`,
    public_token: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    status: "placed",
    fulfillment_type: fulfillment,
    customer_name: String(body.customer_name ?? ""),
    customer_email: String(body.customer_email ?? ""),
    customer_phone: phone,
    delivery_address_line1: (body.delivery_address_line1 as string) ?? null,
    delivery_address_line2: (body.delivery_address_line2 as string) ?? null,
    delivery_city: (body.delivery_city as string) ?? null,
    delivery_state: (body.delivery_state as string) ?? null,
    delivery_zip: (body.delivery_zip as string) ?? null,
    delivery_instructions: (body.delivery_instructions as string) ?? null,
    payment_method: "pay_at_pickup",
    payment_status: "unpaid",
    currency: "USD",
    user_id: typeof body.user_id === "string" ? body.user_id : null,
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    subtotal_cents: subtotal,
    delivery_fee_cents: null,
    total_cents: subtotal,
    notes: null,
    is_demo: true,
    item_count: items.reduce((n, i) => n + i.quantity, 0),
    items,
    created_at: now,
    placed_at: now,
    paid_at: null,
    cancelled_at: null,
  };
  store.orders.unshift(order);
  if (key) store.idempotency.set(key, order.id);
  return toPublicOrder(order);
}

export function getOrderByToken(token: string) {
  const o = getStore().orders.find((x) => x.public_token === token);
  if (!o) throw new ApiHttpError(404, "Order not found.", "not_found");
  return toPublicOrder(o);
}

export function listOrdersForUser(userId: string) {
  return getStore()
    .orders.filter((o) => o.user_id === userId)
    .map(toPublicOrder);
}

export function recordAudit(entry: Omit<AuditLog, "id" | "created_at">) {
  const store = getStore();
  store.auditLogs.unshift({
    ...entry,
    id: nextId(store.auditLogs),
    created_at: new Date().toISOString(),
  });
}

export function listOrders(params: { q?: string; status?: string; page?: number }) {
  let rows = getStore().orders;
  if (params.status) rows = rows.filter((o) => o.status === params.status);
  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter((o) => o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q));
  }
  return pageOf(rows.map(toAdminOrderRow), params.page ?? 1, 25);
}

export function getAdminOrder(id: number) {
  const o = getStore().orders.find((x) => x.id === id);
  if (!o) throw new ApiHttpError(404, "Order not found.", "not_found");
  return o;
}

export function updateOrderStatus(id: number, status: string) {
  const allowed = ["placed", "confirmed", "ready", "completed", "cancelled"];
  if (!allowed.includes(status)) {
    throw new ApiHttpError(400, `Invalid status. Allowed: ${allowed.join(", ")}`, "validation");
  }
  const o = getAdminOrder(id);
  o.status = status;
  return o;
}

export function listPromotions() {
  return getStore().promotions;
}

export function createPromotion(body: { name: string; discount_percent?: number; is_active?: boolean; description?: string | null }) {
  const store = getStore();
  const promo: Promo = {
    id: nextId(store.promotions),
    name: body.name,
    description: body.description ?? null,
    discount_percent: body.discount_percent ?? null,
    is_active: body.is_active ?? true,
  };
  store.promotions.push(promo);
  return promo;
}

export function catalogSources() {
  return getStore().catalog_sources;
}

export function patchCatalogSource(id: number, body: Record<string, unknown>) {
  const s = getStore().catalog_sources.find((x) => x.id === id);
  if (!s) throw new ApiHttpError(404, "Source not found.", "not_found");
  if (typeof body.enabled === "boolean") s.enabled = body.enabled;
  if (typeof body.product_limit === "number") s.product_limit = Math.min(12, Math.max(1, body.product_limit));
  return s;
}

const importRuns = new Map<string, Record<string, unknown>>();

export function listCatalogImports() {
  return [...importRuns.values()];
}

export function createCatalogImport(body: Record<string, unknown>) {
  const id = `hosted-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const run = {
    id,
    status: "failed",
    started_at: now,
    completed_at: now,
    brand_slugs: Array.isArray(body.brand_slugs) ? body.brand_slugs : [],
    per_brand_limit: body.per_brand_limit ?? 6,
    download_images: body.download_images ?? true,
    dry_run: body.dry_run ?? false,
    stats: {},
    robots_summary: {},
    error_message:
      "Live manufacturer collection runs with the local Python collector (npm run catalog:collect). This hosted demo already includes the imported official catalog.",
    product_count: 0,
    products: [],
  };
  importRuns.set(id, run);
  return run;
}

export function getCatalogImport(runId: string) {
  const run = importRuns.get(runId);
  if (!run) throw new ApiHttpError(404, "Import run not found.", "not_found");
  return run;
}

export const CSV_TEMPLATE = `product_full_name,brand,category,sku,supplier_sku,upc,msrp,store_srp,cost_price,availability,size,form,strength,image_url
`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function previewCsv(text: string) {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { filename: "upload.csv", total_rows: 0, creatable: 0, updatable: 0, invalid: 0, rows: [] };
  }
  const header = rows[0].map((h) => h.trim());
  const nameIdx = header.indexOf("name");
  const skuIdx = header.indexOf("sku");
  const out = rows.slice(1).map((cols, i) => {
    const name = nameIdx >= 0 ? cols[nameIdx] : "";
    const sku = skuIdx >= 0 ? cols[skuIdx] : "";
    const errors: string[] = [];
    if (!name) errors.push("Name is required.");
    if (!sku) errors.push("SKU is required.");
    const exists = getStore().products.some((p) => p.sku === sku);
    return {
      line: i + 2,
      action: errors.length ? "invalid" : exists ? "update" : "create",
      name: name || null,
      sku: sku || null,
      errors,
      warnings: [] as string[],
    };
  });
  return {
    filename: "upload.csv",
    total_rows: out.length,
    creatable: out.filter((r) => r.action === "create").length,
    updatable: out.filter((r) => r.action === "update").length,
    invalid: out.filter((r) => r.action === "invalid").length,
    rows: out,
  };
}

export function commitCsv(text: string) {
  const preview = previewCsv(text);
  const rows = parseCsv(text);
  const header = rows[0]?.map((h) => h.trim()) ?? [];
  const idx = (key: string) => header.indexOf(key);
  let created = 0;
  for (const cols of rows.slice(1)) {
    const sku = cols[idx("sku")]?.trim();
    const name = cols[idx("name")]?.trim();
    if (!sku || !name) continue;
    if (getStore().products.some((p) => p.sku === sku)) continue;
    const brandName = cols[idx("brand")]?.trim() || "Demo Brand";
    let brand = getStore().brands.find((b) => b.name.toLowerCase() === brandName.toLowerCase());
    if (!brand) brand = createBrand({ name: brandName });
    const catName = cols[idx("category")]?.trim() || "Supplements";
    let cat = getStore().categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
    if (!cat) cat = createCategory({ name: catName });
    const dollars = cols[idx("regular_price")] || "0";
    const cents = Math.round(Number.parseFloat(dollars) * 100) || 0;
    createProduct({
      name,
      sku,
      brand_id: brand.id,
      category_id: cat.id,
      form: cols[idx("form")] || null,
      regular_price_cents: cents,
      availability: cols[idx("availability")] || "in_stock",
      short_description: cols[idx("short_description")] || null,
      is_active: false,
      is_demo: true,
    });
    created += 1;
  }
  return { ...preview, message: `Imported ${created} new inactive row(s) for review.` };
}

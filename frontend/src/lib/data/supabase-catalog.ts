import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env/public";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { discountPercent, effectivePriceCents } from "@/lib/money";
import { documentFromProduct, searchDocuments } from "@/lib/search/catalog-search";
import type {
  Brand,
  Category,
  FilterOptions,
  Page,
  ProductDetail,
  ProductListItem,
  ProductQuery,
} from "@/lib/api/types";
import { PUBLIC_VARIANT_COLUMNS } from "./public-variant-columns";
import { orderDashboardSummary } from "./supabase-orders";

const SUPABASE_PAGE_SIZE = 1000;

type SupabasePage<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

async function fetchAllSupabaseRows<T>(
  readPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await readPage(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) throw new ApiHttpError(503, "Catalog is unavailable.", "upstream");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) return rows;
  }
}

function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = publicEnv.supabaseUrl?.replace(/\/$/, "");
  return base ? `${base}/storage/v1/object/public/product-images/${path}` : path;
}

function mapProduct(row: Record<string, unknown>): ProductDetail {
  const brand = (row.brands as Record<string, string> | null) ?? {};
  const category = (row.categories as Record<string, string> | null) ?? {};
  const variants = (row.product_variants as Record<string, unknown>[] | null) ?? [];
  const variant = variants.find((v) => v.is_default) ?? variants[0] ?? {};
  const images = ((row.product_images as Record<string, unknown>[] | null) ?? []).map((img, i) => ({
    id: i + 1,
    url: mediaUrl(String(img.storage_path ?? "")) ?? "",
    alt_text: (img.alt_text as string | null) ?? null,
    display_order: Number(img.display_order ?? i),
    is_primary: Boolean(img.is_primary),
  }));
  const tags = (row.product_tags as { tag_type?: string; tag?: string }[] | null) ?? [];
  const dietaryTags = tags.filter((t) => t.tag_type === "dietary").map((t) => t.tag ?? "");
  const regular = Number(variant.regular_price_cents ?? 0);
  const sale = variant.sale_price_cents == null ? null : Number(variant.sale_price_cents);
  const detail: ProductDetail = {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    brand_name: brand.name ?? "",
    brand_slug: brand.slug ?? "",
    category_name: category.name ?? "",
    category_slug: category.slug ?? "",
    form: (variant.form as string | null) ?? null,
    size: variant.size_value != null ? `${variant.size_value}${variant.size_unit ?? ""}` : null,
    count: variant.unit_count == null ? null : Number(variant.unit_count),
    strength_value: variant.strength_value == null ? null : Number(variant.strength_value),
    strength_unit: (variant.strength_unit as string | null) ?? null,
    availability: String(variant.availability ?? "in_stock"),
    regular_price_cents: regular,
    sale_price_cents: sale,
    effective_price_cents: effectivePriceCents(regular, sale),
    discount_percent: discountPercent(regular, sale),
    on_sale: sale != null && sale < regular,
    is_featured: Boolean(row.is_featured),
    is_bestseller: Boolean(row.is_best_seller),
    is_new: Boolean(row.is_new),
    is_demo: false,
    short_description: (row.short_description as string | null) ?? null,
    primary_image_url: images.find((i) => i.is_primary)?.url || images[0]?.url || null,
    dietary: {
      vegan: dietaryTags.includes("vegan"),
      vegetarian: dietaryTags.includes("vegetarian"),
      organic: dietaryTags.includes("organic"),
      gluten_free: dietaryTags.includes("gluten_free"),
      soy_free: dietaryTags.includes("soy_free"),
      dairy_free: dietaryTags.includes("dairy_free"),
      alcohol_free: dietaryTags.includes("alcohol_free"),
      non_gmo: dietaryTags.includes("non_gmo"),
    },
    long_description: (row.description as string | null) ?? null,
    sku: String(variant.sku ?? variant.supplier_sku ?? ""),
    upc: (variant.upc as string | null) ?? null,
    ingredient_highlights: null,
    usage_text: (row.suggested_use as string | null) ?? null,
    warnings: (row.warnings as string | null) ?? null,
    search_aliases: Array.isArray(row.search_aliases) ? (row.search_aliases as string[]) : [],
    wellness_tags: tags.filter((t) => t.tag_type === "health_goal").map((t) => t.tag ?? ""),
    images,
    is_active: row.status === "active",
    is_archived: row.status === "archived",
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
    brand_id: (row.brand_id as string | null) ?? null,
    category_id: (row.category_id as string | null) ?? null,
  };
  return detail;
}

async function fetchActiveProducts(): Promise<ProductDetail[]> {
  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "Supabase is not configured.", "config");
  const data = await fetchAllSupabaseRows<Record<string, unknown>>((from, to) =>
    client
      .from("products")
      .select(
        `id,name,slug,status,brand_id,category_id,short_description,description,suggested_use,warnings,search_aliases,is_featured,is_best_seller,is_new,created_at,updated_at,brands(name,slug),categories(name,slug),product_variants(${PUBLIC_VARIANT_COLUMNS}),product_images(storage_path,alt_text,is_primary,display_order),product_tags(tag_type,tag)`,
      )
      .eq("status", "active")
      .order("id")
      .range(from, to),
  );
  return data.map((row) => mapProduct(row));
}

function pageOf<T>(items: T[], page = 1, pageSize = 24): Page<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    total: items.length,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

type Facet = "brand" | "category" | "form" | "availability" | "dietary";

function filterCatalog(
  source: ProductDetail[],
  pq: ProductQuery,
  excluded: ReadonlySet<Facet> = new Set(),
) {
  let items = [...source];
  if (!excluded.has("brand") && pq.brand) items = items.filter((p) => p.brand_slug === pq.brand);
  if (!excluded.has("category") && pq.category) items = items.filter((p) => p.category_slug === pq.category);
  if (!excluded.has("form") && pq.form) items = items.filter((p) => p.form === pq.form);
  if (!excluded.has("availability") && pq.availability) {
    items = items.filter((p) => p.availability === pq.availability);
  }
  if (pq.on_sale != null) items = items.filter((p) => p.on_sale === pq.on_sale);
  if (pq.featured != null) items = items.filter((p) => p.is_featured === pq.featured);
  if (pq.bestseller != null) items = items.filter((p) => p.is_bestseller === pq.bestseller);
  if (pq.is_new != null) items = items.filter((p) => p.is_new === pq.is_new);
  if (pq.price_min != null) items = items.filter((p) => p.effective_price_cents >= pq.price_min!);
  if (pq.price_max != null) items = items.filter((p) => p.effective_price_cents <= pq.price_max!);
  if (!excluded.has("dietary")) {
    for (const dietary of pq.dietary ?? []) {
      if (dietary in (items[0]?.dietary ?? {})) {
        items = items.filter((p) => Boolean(p.dietary[dietary as keyof typeof p.dietary]));
      }
    }
  }
  if (pq.q?.trim()) {
    const hits = searchDocuments(items.map((p) => documentFromProduct(p)), pq.q);
    const ids = new Set(hits.map((hit) => String(hit.id)));
    items = items.filter((p) => ids.has(String(p.id)));
  }
  return items;
}

export async function listProducts(pq: ProductQuery, includeInactive = false) {
  if (includeInactive) {
    throw new ApiHttpError(400, "Use the live admin product API for unpublished rows.", "config");
  }
  const items = filterCatalog(await fetchActiveProducts(), pq);
  if (pq.q?.trim()) {
    const rank = new Map(
      searchDocuments(items.map((p) => documentFromProduct(p)), pq.q).map((hit, index) => [String(hit.id), index]),
    );
    items.sort((a, b) => (rank.get(String(a.id)) ?? 0) - (rank.get(String(b.id)) ?? 0));
  }
  if (!pq.q?.trim() || (pq.sort && pq.sort !== "relevance")) {
    const byName = (a: ProductDetail, b: ProductDetail) => a.name.localeCompare(b.name);
    if (pq.sort === "price_asc") {
      items.sort((a, b) => a.effective_price_cents - b.effective_price_cents || byName(a, b));
    } else if (pq.sort === "price_desc") {
      items.sort((a, b) => b.effective_price_cents - a.effective_price_cents || byName(a, b));
    } else if (pq.sort === "name_asc") {
      items.sort(byName);
    } else if (pq.sort === "newest") {
      items.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || byName(a, b));
    } else if (pq.sort === "discount") {
      items.sort((a, b) => (b.discount_percent ?? 0) - (a.discount_percent ?? 0) || byName(a, b));
    } else {
      items.sort((a, b) => {
        const stock = (p: ProductDetail) => (p.availability === "in_stock" ? 0 : 1);
        return stock(a) - stock(b) || Number(b.is_bestseller) - Number(a.is_bestseller) || Number(b.is_featured) - Number(a.is_featured) || byName(a, b);
      });
    }
  }
  const list = items.map((p) => ({
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
  }));
  return pageOf(list, pq.page ?? 1, pq.page_size ?? 24);
}

export async function getProductBySlug(slug: string) {
  const items = await fetchActiveProducts();
  const found = items.find((p) => p.slug === slug);
  if (!found) throw new ApiHttpError(404, "Product not found.", "not_found");
  return found;
}

export async function relatedFor(slug: string) {
  const product = await getProductBySlug(slug);
  const all = await fetchActiveProducts();
  const related = all
    .filter((p) => p.slug !== slug)
    .filter((p) => p.category_slug === product.category_slug || p.brand_slug === product.brand_slug)
    .slice(0, 8)
    .map((p) => p as unknown as ProductListItem);
  return { items: related, total: related.length, page: 1, page_size: 8, pages: 1 };
}

export async function suggestions(q: string) {
  const query = q.trim();
  if (query.length < 2) return { items: [] };

  const all = await fetchActiveProducts();
  const needle = query.toLocaleLowerCase();
  const categories = new Map<string, string>();
  const brands = new Map<string, string>();
  for (const product of all) {
    if (product.category_slug && product.category_name) {
      categories.set(product.category_slug, product.category_name);
    }
    if (product.brand_slug && product.brand_name) {
      brands.set(product.brand_slug, product.brand_name);
    }
  }

  const taxonomyItems = [
    ...[...categories]
      .filter(([slug, name]) => slug.toLocaleLowerCase().includes(needle) || name.toLocaleLowerCase().includes(needle))
      .map(([slug, name]) => ({ type: "category", name, slug, href: `/categories/${slug}` })),
    ...[...brands]
      .filter(([slug, name]) => slug.toLocaleLowerCase().includes(needle) || name.toLocaleLowerCase().includes(needle))
      .map(([slug, name]) => ({ type: "brand", name, slug, href: `/brands/${slug}` })),
  ].sort((a, b) => {
    const exactA = a.name.toLocaleLowerCase() === needle ? 0 : 1;
    const exactB = b.name.toLocaleLowerCase() === needle ? 0 : 1;
    return exactA - exactB || a.name.localeCompare(b.name);
  });

  const matchingProducts = filterCatalog(all, { q: query });
  const rank = new Map(
    searchDocuments(matchingProducts.map((product) => documentFromProduct(product)), query).map(
      (hit, index) => [String(hit.id), index],
    ),
  );
  matchingProducts.sort(
    (a, b) =>
      (rank.get(String(a.id)) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(String(b.id)) ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    items: [
      ...taxonomyItems,
      ...matchingProducts.slice(0, 8).map((product) => ({
        type: "product",
        name: product.name,
        slug: product.slug,
        href: `/products/${product.slug}`,
        brand_name: product.brand_name,
      })),
    ].slice(0, 12),
  };
}

export async function filters(pq: ProductQuery = {}): Promise<FilterOptions> {
  const items = await fetchActiveProducts();
  const brands = new Map<string, { name: string; slug: string; count: number }>();
  const categories = new Map<string, { name: string; slug: string; count: number }>();
  const forms = new Map<string, number>();
  const dietary = new Set<string>();
  for (const p of filterCatalog(items, pq, new Set(["brand"]))) {
    brands.set(p.brand_slug, {
      name: p.brand_name,
      slug: p.brand_slug,
      count: (brands.get(p.brand_slug)?.count ?? 0) + 1,
    });
  }
  for (const p of filterCatalog(items, pq, new Set(["category"]))) {
    categories.set(p.category_slug, {
      name: p.category_name,
      slug: p.category_slug,
      count: (categories.get(p.category_slug)?.count ?? 0) + 1,
    });
  }
  for (const p of filterCatalog(items, pq, new Set(["form"]))) {
    if (p.form) forms.set(p.form, (forms.get(p.form) ?? 0) + 1);
  }
  for (const p of filterCatalog(items, pq, new Set(["dietary"]))) {
    for (const [key, enabled] of Object.entries(p.dietary)) {
      if (enabled) dietary.add(key);
    }
  }
  const prices = filterCatalog(items, pq).map((p) => p.effective_price_cents);
  return {
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)),
    forms: [...forms.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    dietary: [...dietary].sort(),
    price_min_cents: prices.length ? Math.min(...prices) : 0,
    price_max_cents: prices.length ? Math.max(...prices) : 0,
  };
}

export async function listBrands(): Promise<Brand[]> {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data } = await client.from("brands").select("id,name,slug,description,is_featured,display_order,discount_percent").eq("is_active", true);
  return (data ?? []).map((b) => ({
    id: String(b.id),
    name: String(b.name ?? ""),
    slug: String(b.slug ?? ""),
    description: (b.description as string | null) ?? null,
    is_featured: Boolean(b.is_featured),
    discount_percent: b.discount_percent == null ? null : Number(b.discount_percent),
  }));
}

export async function listCategories(): Promise<Category[]> {
  const client = getSupabaseAdminClient();
  if (!client) return [];
  const { data } = await client.from("categories").select("id,name,slug,parent_id,description,display_order").eq("is_active", true);
  return (data ?? []).map((c, i) => ({
    id: String(c.id),
    name: String(c.name ?? ""),
    slug: String(c.slug ?? ""),
    parent_id: c.parent_id ? String(c.parent_id) : null,
    description: (c.description as string | null) ?? null,
    display_order: Number(c.display_order ?? i),
  }));
}

export async function getBrand(slug: string) {
  const brands = await listBrands();
  const found = brands.find((b) => b.slug === slug);
  if (!found) throw new ApiHttpError(404, "Brand not found.", "not_found");
  return found;
}

export async function getCategory(slug: string) {
  const cats = await listCategories();
  const found = cats.find((c) => c.slug === slug);
  if (!found) throw new ApiHttpError(404, "Category not found.", "not_found");
  return found;
}

export async function listTags() {
  return [];
}

export async function dashboard() {
  const client = getSupabaseAdminClient();
  if (!client) throw new ApiHttpError(503, "Supabase is not configured.", "config");

  const [productRows, brandsRes, categoriesRes, imageRows, batchesRes, variantRows, orders] = await Promise.all([
    fetchAllSupabaseRows<{ id: string; status: string; is_new: boolean }>((from, to) =>
      client.from("products").select("id,status,is_new").order("id").range(from, to),
    ),
    client.from("brands").select("id", { count: "exact", head: true }),
    client.from("categories").select("id", { count: "exact", head: true }),
    fetchAllSupabaseRows<{ id: string; product_id: string }>((from, to) =>
      client.from("product_images").select("id,product_id").order("id").range(from, to),
    ),
    client.from("catalog_import_batches").select("id", { count: "exact", head: true }),
    fetchAllSupabaseRows<{
      id: string;
      product_id: string;
      regular_price_cents: number;
      sale_price_cents: number | null;
    }>((from, to) =>
      client
        .from("product_variants")
        .select("id,product_id,regular_price_cents,sale_price_cents")
        .order("id")
        .range(from, to),
    ),
    orderDashboardSummary(),
  ]);

  const live = productRows.filter((row) => row.status !== "archived");
  const imaged = new Set(imageRows.map((row) => String(row.product_id)));
  const onSaleIds = new Set(
    variantRows
      .filter((row) => {
        const sale = row.sale_price_cents == null ? null : Number(row.sale_price_cents);
        const regular = Number(row.regular_price_cents ?? 0);
        return sale != null && sale < regular;
      })
      .map((row) => String(row.product_id)),
  );

  return {
    total_products: live.length,
    active_products: live.filter((row) => row.status === "active").length,
    draft_products: live.filter((row) => row.status === "draft").length,
    brand_count: brandsRes.count ?? 0,
    category_count: categoriesRes.count ?? 0,
    on_sale: live.filter((row) => onSaleIds.has(String(row.id))).length,
    missing_images: live.filter((row) => !imaged.has(String(row.id))).length,
    recent_import_count: batchesRes.count ?? 0,
    out_of_stock: 0,
    new_products: live.filter((row) => Boolean(row.is_new)).length,
    total_orders: orders.total,
    recent_orders: orders.recent,
    persistence: "database" as const,
  };
}

export const supabaseCatalog = {
  listProducts,
  getProductBySlug,
  relatedFor,
  suggestions,
  filters,
  listBrands,
  listCategories,
  getBrand,
  getCategory,
  listTags,
  dashboard,
};

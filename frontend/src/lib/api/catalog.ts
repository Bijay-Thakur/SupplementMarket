import { apiFetch, toQuery } from "./client";
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
  Tag,
} from "./types";

export function listProducts(q: ProductQuery = {}) {
  return apiFetch<Page<ProductListItem>>(
    `/api/v1/products${toQuery({
      q: q.q,
      brand: q.brand,
      category: q.category,
      form: q.form,
      price_min: q.price_min,
      price_max: q.price_max,
      availability: q.availability,
      dietary: q.dietary,
      featured: q.featured,
      bestseller: q.bestseller,
      is_new: q.is_new,
      on_sale: q.on_sale,
      sort: q.sort,
      page: q.page,
      page_size: q.page_size,
    })}`,
  );
}

export function getProduct(slug: string) {
  return apiFetch<ProductDetail>(`/api/v1/products/${encodeURIComponent(slug)}`);
}

export function relatedProducts(slug: string) {
  return apiFetch<Page<ProductListItem>>(
    `/api/v1/products/${encodeURIComponent(slug)}/related`,
  );
}

export function productSuggestions(q: string) {
  return apiFetch<{ items: { type?: string; name: string; slug?: string; href?: string; brand_name?: string }[] }>(
    `/api/v1/products/suggestions${toQuery({ q })}`,
  );
}

export function getFilters() {
  return apiFetch<FilterOptions>("/api/v1/products/filters");
}

export function listBrands() {
  return apiFetch<Brand[]>("/api/v1/brands");
}

export function adminListBrands() {
  return apiFetch<Brand[]>("/api/v1/admin/brands");
}

export function listCategories() {
  return apiFetch<Category[]>("/api/v1/categories");
}

export function listTags() {
  return apiFetch<Tag[]>("/api/v1/tags");
}

export function getStoreSettings() {
  return apiFetch<StoreSettings>("/api/v1/store-settings");
}

export function createOrder(body: unknown) {
  return apiFetch<OrderPublic>("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getOrder(publicToken: string) {
  return apiFetch<OrderPublic>(`/api/v1/orders/${encodeURIComponent(publicToken)}`);
}

export function adminProducts(params: ProductQuery & { availability?: string } = {}) {
  return apiFetch<Page<AdminProductRow>>(
    `/api/v1/admin/products${toQuery({
      q: params.q,
      brand: params.brand,
      category: params.category,
      availability: params.availability,
      on_sale: params.on_sale,
      sort: params.sort ?? "newest",
      page: params.page,
      page_size: params.page_size,
    })}`,
  );
}

export function adminGetProduct(id: number | string) {
  return apiFetch<ProductDetail>(`/api/v1/admin/products/${id}`);
}

export function adminCreateProduct(body: unknown) {
  return apiFetch<ProductDetail>("/api/v1/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function adminUpdateProduct(id: number | string, body: unknown) {
  return apiFetch<ProductDetail>(`/api/v1/admin/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function adminArchiveProduct(id: number | string) {
  return apiFetch<ProductDetail>(`/api/v1/admin/products/${id}`, { method: "DELETE" });
}

export function adminUploadProductImage(id: number | string, file: File, altText = "") {
  const body = new FormData();
  body.append("file", file);
  body.append("alt_text", altText);
  return apiFetch<{ ok: boolean; storage_path?: string }>(`/api/admin/products/${id}/image`, {
    method: "POST",
    body,
  });
}

export function adminDuplicateProduct(id: number | string) {
  return apiFetch<ProductDetail>(`/api/v1/admin/products/${id}/duplicate`, {
    method: "POST",
  });
}

export function adminDashboard() {
  return apiFetch<{
    active_products: number;
    on_sale: number;
    out_of_stock: number;
    new_products: number;
    total_orders: number;
    total_products?: number;
    draft_products?: number;
    brand_count?: number;
    category_count?: number;
    missing_images?: number;
    recent_import_count?: number;
    recent_orders: AdminOrderRow[];
    persistence?: "session" | "database";
    persistence_notice?: string;
  }>("/api/v1/admin/dashboard");
}

export function adminOrders(params: { q?: string; status?: string; page?: number } = {}) {
  return apiFetch<Page<AdminOrderRow>>(`/api/v1/admin/orders${toQuery(params)}`);
}

export function adminGetOrder(id: number) {
  return apiFetch<AdminOrderDetail>(`/api/v1/admin/orders/${id}`);
}

export function adminUpdateOrderStatus(id: number, status: string) {
  return apiFetch<AdminOrderDetail>(`/api/v1/admin/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function adminUpdateSettings(body: unknown) {
  return apiFetch<StoreSettings>("/api/v1/admin/store-settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function resetDemo() {
  return apiFetch<{ ok: boolean; message: string }>("/api/v1/dev/reset", {
    method: "POST",
  });
}

export function createBrand(body: unknown) {
  return apiFetch<Brand>("/api/v1/admin/brands", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function adminUpdateBrand(id: number | string, body: unknown) {
  return apiFetch<Brand>(`/api/v1/admin/brands/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getAccountProfile() {
  return apiFetch<{ user: unknown; addresses: unknown[] }>("/api/v1/account/profile");
}

export function patchAccountProfile(body: unknown) {
  return apiFetch<{ user: unknown }>("/api/v1/account/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function listAccountAddresses() {
  return apiFetch<unknown[]>("/api/v1/account/addresses");
}

export function createAccountAddress(body: unknown) {
  return apiFetch("/api/v1/account/addresses", { method: "POST", body: JSON.stringify(body) });
}

export function deleteAccountAddress(id: string) {
  return apiFetch(`/api/v1/account/addresses/${id}`, { method: "DELETE" });
}

export function listAccountOrders() {
  return apiFetch<{ items: OrderPublic[] }>("/api/v1/account/orders");
}

export function createCategory(body: unknown) {
  return apiFetch<Category>("/api/v1/admin/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createTag(body: unknown) {
  return apiFetch<Tag>("/api/v1/admin/tags", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type CatalogSource = {
  id: number;
  slug: string;
  name: string;
  parent_brand: string | null;
  official_url: string;
  collection_url: string;
  domain: string;
  enabled: boolean;
  product_limit: number;
  policy_status: string;
  policy_notes: string | null;
  robots_status: string | null;
  last_checked_at: string | null;
  last_run_id: string | null;
  last_result: string | null;
};

export type CatalogRunSummary = {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  brand_slugs: string[];
  per_brand_limit: number;
  download_images: boolean;
  dry_run: boolean;
  stats: Record<string, unknown>;
  robots_summary: Record<string, unknown>;
  error_message: string | null;
  product_count: number;
};

export type StagedProduct = {
  id: number;
  status: string;
  brand: string;
  name: string;
  variant_name: string | null;
  primary_category: string | null;
  form: string | null;
  strength_value: number | null;
  strength_unit: string | null;
  count: number | null;
  size: string | null;
  vegan: boolean;
  vegetarian: boolean;
  organic: boolean;
  gluten_free: boolean;
  non_gmo: boolean;
  source_price_cents: number | null;
  regular_price_cents: number;
  discount_percent: number | null;
  sale_price_cents: number | null;
  price_is_demo: boolean;
  official_bestseller: boolean;
  official_featured: boolean;
  official_new: boolean;
  image_status: string;
  source_policy_status: string | null;
  validation_errors: string[] | null;
  duplicate_key: string | null;
  canonical_url: string;
  short_description: string | null;
  sku: string | null;
  upc: string | null;
  extraction_method: string | null;
  image_use_status: string | null;
  imported_product_id: number | null;
  thumbnail_url: string | null;
  images: {
    id: number;
    source_url: string | null;
    optimized_url: string | null;
    alt_text: string | null;
    status: string;
    permission_status: string;
    sha256: string | null;
  }[];
  source_snapshot: Record<string, unknown> | null;
  admin_edited_fields: string[] | null;
};

export type CatalogRunDetail = CatalogRunSummary & { products: StagedProduct[] };

export function catalogSources() {
  return apiFetch<CatalogSource[]>("/api/v1/admin/catalog-sources");
}

export function patchCatalogSource(id: number, body: unknown) {
  return apiFetch<CatalogSource>(`/api/v1/admin/catalog-sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function catalogImports() {
  return apiFetch<CatalogRunSummary[]>("/api/v1/admin/catalog-imports");
}

export function createCatalogImport(body: unknown) {
  return apiFetch<CatalogRunSummary>("/api/v1/admin/catalog-imports", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getCatalogImport(runId: string, params: Record<string, string | boolean | undefined> = {}) {
  return apiFetch<CatalogRunDetail>(`/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}${toQuery(params)}`);
}

export function catalogApprove(runId: string, ids: number[]) {
  return apiFetch<{ ok: boolean; updated: number }>(
    `/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}/approve`,
    { method: "POST", body: JSON.stringify({ ids }) },
  );
}

export function catalogReject(runId: string, ids: number[]) {
  return apiFetch<{ ok: boolean; updated: number }>(
    `/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}/reject`,
    { method: "POST", body: JSON.stringify({ ids }) },
  );
}

export function catalogImportApproved(runId: string, body: { ids?: number[]; activate_after_import?: boolean }) {
  return apiFetch<{ ok: boolean; created: number; skipped: number }>(
    `/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}/import`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function catalogRecalculate(runId: string, ids: number[]) {
  return apiFetch<{ ok: boolean; updated: number }>(
    `/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}/recalculate`,
    { method: "POST", body: JSON.stringify({ ids }) },
  );
}

export function patchStagedProduct(runId: string, productId: number, body: unknown) {
  return apiFetch<StagedProduct>(
    `/api/v1/admin/catalog-imports/${encodeURIComponent(runId)}/products/${productId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

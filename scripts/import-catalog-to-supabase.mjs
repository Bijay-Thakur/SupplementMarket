/**
 * Idempotent demo-catalog import into the current Supabase UUID schema.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Catalog tables and the product-images bucket are the only remote targets.
 */
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(repoRoot, ".env.local"), override: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const catalog = JSON.parse(await readFile(resolve(repoRoot, "frontend/src/data/catalog.json"), "utf8"));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const report = {
  products_created: 0,
  products_updated: 0,
  variants_saved: 0,
  images_uploaded: 0,
  images_skipped: 0,
  tags_saved: 0,
  errors: [],
};

function recordError(scope, error) {
  report.errors.push(`${scope}: ${error.message}`);
}

async function saveBrands() {
  const current = await supabase.from("brands").select("id,name,slug");
  if (current.error) throw new Error(`brands: ${current.error.message}`);
  const byCatalogSlug = new Map();
  for (const brand of catalog.brands) {
    const existing = (current.data ?? []).find(
      (row) => row.slug === brand.slug || row.name.toLowerCase() === brand.name.toLowerCase(),
    );
    const values = {
      name: brand.name,
      description: brand.description ?? null,
      is_featured: Boolean(brand.is_featured),
      is_active: true,
      display_order: Number(brand.display_order ?? 0),
    };
    const saved = existing
      ? await supabase.from("brands").update(values).eq("id", existing.id).select("id").single()
      : await supabase.from("brands").insert({ ...values, slug: brand.slug }).select("id").single();
    if (saved.error) throw new Error(`brand ${brand.slug}: ${saved.error.message}`);
    byCatalogSlug.set(brand.slug, saved.data.id);
  }
  return byCatalogSlug;
}

async function saveCategories() {
  const rows = catalog.categories.map((category) => ({
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    is_active: true,
    display_order: Number(category.display_order ?? 0),
  }));
  const { error } = await supabase.from("categories").upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`categories: ${error.message}`);
  const result = await supabase.from("categories").select("id,slug").in("slug", rows.map((row) => row.slug));
  if (result.error) throw new Error(`categories: ${result.error.message}`);
  const bySlug = new Map((result.data ?? []).map((row) => [row.slug, row.id]));
  const oldIdToSlug = new Map(catalog.categories.map((row) => [row.id, row.slug]));
  for (const category of catalog.categories) {
    const parentSlug = oldIdToSlug.get(category.parent_id);
    if (!parentSlug) continue;
    const update = await supabase
      .from("categories")
      .update({ parent_id: bySlug.get(parentSlug) ?? null })
      .eq("slug", category.slug);
    if (update.error) recordError(`category ${category.slug}`, update.error);
  }
  return bySlug;
}

function sizeParts(product) {
  if (!product.size) return { size_value: null, size_unit: null };
  const match = String(product.size).trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { size_value: null, size_unit: String(product.size).slice(0, 40) };
  return { size_value: Number(match[1]), size_unit: match[2] || null };
}

function canonicalForm(form) {
  if (!form) return null;
  if (form === "chewable") return "tablet";
  return form;
}

async function saveVariant(productId, product) {
  const existing = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("is_default", true)
    .maybeSingle();
  if (existing.error) throw existing.error;
  const row = {
    product_id: productId,
    label: product.size || product.form || "Default",
    sku: product.sku || null,
    upc: product.upc || null,
    supplier_sku: product.sku || null,
    form: canonicalForm(product.form),
    strength_value: product.strength_value ?? null,
    strength_unit: product.strength_unit ?? null,
    ...sizeParts(product),
    unit_count: product.count ?? null,
    regular_price_cents: Number(product.regular_price_cents ?? 0),
    sale_price_cents: product.sale_price_cents ?? null,
    availability: product.availability || "in_stock",
    is_default: true,
    is_active: product.is_active !== false && !product.is_archived,
    display_order: 0,
    source_name: "bundled-demo-catalog",
  };
  const result = existing.data
    ? await supabase.from("product_variants").update(row).eq("id", existing.data.id)
    : await supabase.from("product_variants").insert(row);
  if (result.error) throw result.error;
  report.variants_saved += 1;
}

function contentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".avif") return "image/avif";
  return "image/webp";
}

async function saveImages(productId, product) {
  for (let index = 0; index < (product.images ?? []).length; index += 1) {
    const image = product.images[index];
    if (!image.url?.startsWith("/media/products/")) {
      report.images_skipped += 1;
      continue;
    }
    const localPath = resolve(repoRoot, "frontend/public", image.url.replace(/^\//, ""));
    try {
      const current = await supabase
        .from("product_images")
        .select("id,storage_path")
        .eq("product_id", productId)
        .eq("display_order", Number(image.display_order ?? index))
        .maybeSingle();
      if (current.error) throw current.error;
      const filename = image.url.split("/").pop();
      const objectPath = current.data?.storage_path ?? `demo/${product.slug}/${filename}`;
      const bytes = await readFile(localPath);
      const uploaded = await supabase.storage.from("product-images").upload(objectPath, bytes, {
        contentType: contentType(localPath),
        cacheControl: "3600",
        upsert: true,
      });
      if (uploaded.error) throw uploaded.error;
      const values = {
          product_id: productId,
          storage_path: objectPath,
          alt_text: image.alt_text ?? product.name,
          is_primary: Boolean(image.is_primary ?? index === 0),
          display_order: Number(image.display_order ?? index),
          source_url: product.source_url ?? null,
          usage_verified: false,
        };
      const saved = current.data
        ? await supabase.from("product_images").update(values).eq("id", current.data.id)
        : await supabase.from("product_images").insert(values);
      if (saved.error) throw saved.error;
      report.images_uploaded += 1;
    } catch (error) {
      report.images_skipped += 1;
      recordError(`image ${product.slug}`, error);
    }
  }
}

async function saveTags(productId, product) {
  const tags = [];
  for (const [tag, enabled] of Object.entries(product.dietary ?? {})) {
    if (enabled) tags.push({ product_id: productId, tag_type: "dietary", tag });
  }
  for (const tag of product.wellness_tags ?? []) {
    if (tag) tags.push({ product_id: productId, tag_type: "health_goal", tag: String(tag) });
  }
  if (!tags.length) return;
  const result = await supabase.from("product_tags").upsert(tags, {
    onConflict: "product_id,tag_type,tag",
  });
  if (result.error) throw result.error;
  report.tags_saved += tags.length;
}

try {
  const brandIds = await saveBrands();
  const categoryIds = await saveCategories();
  for (const product of catalog.products) {
    try {
      const brandId = brandIds.get(product.brand_slug);
      if (!brandId) throw new Error(`Unknown brand ${product.brand_slug}`);
      const existing = await supabase.from("products").select("id").eq("slug", product.slug).maybeSingle();
      if (existing.error) throw existing.error;
      const saved = await supabase
        .from("products")
        .upsert(
          {
            brand_id: brandId,
            category_id: categoryIds.get(product.category_slug) ?? null,
            name: product.name,
            slug: product.slug,
            short_description: product.short_description ?? null,
            description: product.long_description ?? null,
            suggested_use: product.usage_text ?? null,
            warnings: product.warnings ?? null,
            search_aliases: product.search_aliases ?? [],
            status: product.is_archived ? "archived" : product.is_active === false ? "draft" : "active",
            is_featured: Boolean(product.is_featured),
            is_best_seller: Boolean(product.is_bestseller),
            is_new: Boolean(product.is_new),
            source_url: product.source_url ?? null,
            data_source: product.source_type ?? "bundled-demo-catalog",
          },
          { onConflict: "slug" },
        )
        .select("id")
        .single();
      if (saved.error) throw saved.error;
      if (existing.data) report.products_updated += 1;
      else report.products_created += 1;
      await saveVariant(saved.data.id, product);
      await saveTags(saved.data.id, product);
      await saveImages(saved.data.id, product);
    } catch (error) {
      recordError(`product ${product.slug}`, error);
    }
  }
} catch (error) {
  recordError("catalog", error);
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);

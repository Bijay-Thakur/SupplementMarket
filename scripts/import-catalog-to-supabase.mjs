/**
 * Idempotent catalog import into Supabase.
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Does not log secrets. Skips products marked verified so admin edits survive.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

const catalog = JSON.parse(
  await readFile(resolve(repoRoot, "frontend/src/data/catalog.json"), "utf8"),
);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const report = { created: 0, updated: 0, skipped: 0, skipped_verified: 0, errors: [] };

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    report.errors.push(`${table}: ${error.message}`);
  }
}

await upsert(
  "brands",
  catalog.brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
    description: b.description,
    is_featured: b.is_featured,
    logo_url: b.logo_url ?? null,
    logo_alt: b.logo_alt ?? b.name,
    official_website_url: b.official_website_url ?? null,
    logo_use_status: b.logo_use_status ?? "permission_pending",
    display_order: b.display_order ?? 0,
    is_demo: true,
  })),
  "id",
);

await upsert(
  "categories",
  catalog.categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parent_id: c.parent_id,
    description: c.description,
    display_order: c.display_order,
    is_demo: true,
  })),
  "id",
);

for (const p of catalog.products) {
  const { data: existing } = await supabase.from("products").select("id, verification_status, sku, upc, slug").or(`sku.eq.${p.sku},slug.eq.${p.slug}${p.upc ? `,upc.eq.${p.upc}` : ""}`).maybeSingle();
  if (existing?.verification_status === "verified") {
    report.skipped_verified += 1;
    continue;
  }
  const row = {
    id: p.id,
    brand_id: p.brand_id,
    category_id: p.category_id,
    name: p.name,
    slug: p.slug,
    short_description: p.short_description,
    long_description: p.long_description,
    form: p.form,
    size: p.size,
    count: p.count,
    strength_value: p.strength_value,
    strength_unit: p.strength_unit,
    sku: p.sku,
    upc: p.upc,
    regular_price_cents: p.regular_price_cents,
    sale_price_cents: p.sale_price_cents,
    availability: p.availability,
    is_featured: p.is_featured,
    is_bestseller: p.is_bestseller,
    is_new: p.is_new,
    is_active: p.is_active,
    is_archived: p.is_archived,
    vegan: p.dietary?.vegan ?? false,
    vegetarian: p.dietary?.vegetarian ?? false,
    organic: p.dietary?.organic ?? false,
    gluten_free: p.dietary?.gluten_free ?? false,
    soy_free: p.dietary?.soy_free ?? false,
    dairy_free: p.dietary?.dairy_free ?? false,
    alcohol_free: p.dietary?.alcohol_free ?? false,
    non_gmo: p.dietary?.non_gmo ?? false,
    search_aliases: (p.search_aliases ?? []).join(", "),
    ingredient_highlights: p.ingredient_highlights,
    is_demo: true,
    source_url: p.source_url,
    source_type: p.source_type,
    image_use_status: p.image_use_status,
    verification_status: p.verification_status ?? "unverified",
    approval_status: p.approval_status ?? "approved",
    price_is_demo: p.price_is_demo ?? true,
  };
  const { error } = await supabase.from("products").upsert(row, { onConflict: "id" });
  if (error) report.errors.push(`product ${p.sku}: ${error.message}`);
  else if (existing) report.updated += 1;
  else report.created += 1;

  if (p.images?.length) {
    await supabase.from("product_images").upsert(
      p.images.map((im) => ({
        id: im.id,
        product_id: p.id,
        url: im.url,
        alt_text: im.alt_text,
        display_order: im.display_order,
        is_primary: im.is_primary,
        image_use_status: p.image_use_status,
        is_demo: true,
      })),
      { onConflict: "id" },
    );
  }
}

if (catalog.settings) {
  await supabase.from("store_settings").upsert({ id: 1, ...catalog.settings }, { onConflict: "id" });
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);

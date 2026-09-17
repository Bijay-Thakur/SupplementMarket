import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const migration = read("../supabase/migrations/20260914183000_catalog_recovery_product_delete.sql");
const apiRoute = read("src/app/api/v1/[...path]/route.ts");
const editor = read("src/components/admin/product-editor.tsx");
const catalogBrowser = read("src/components/catalog/catalog-browser.tsx");
const liveCatalog = read("src/lib/data/supabase-catalog.ts");
const cleanupMigration = read("../supabase/migrations/20260915120000_remove_naturesplus_products.sql");
const catalogApi = read("src/lib/api/catalog.ts");
const brandLogoMigration = read("../supabase/migrations/20260916213000_customer_brand_logos.sql");

describe("catalog recovery and deletion", () => {
  it("recovers only stale processing imports", () => {
    expect(migration).toMatch(/v_status = 'processing'[\s\S]*interval '5 minutes'/i);
    expect(migration).toMatch(/recovered_stale_processing/i);
  });

  it("triple-checks permanent product deletion", () => {
    expect(apiRoute).toMatch(/requireSameOrigin\(req\)/);
    expect(apiRoute).toMatch(/await requireAdmin\(req\)/);
    expect(apiRoute).toMatch(/body\.confirmation !== "CONFIRM"/);
    expect(migration).toMatch(/delete_catalog_product/i);
    expect(migration).toMatch(/p_confirmation is distinct from 'CONFIRM'/i);
    expect(migration).toMatch(/to service_role/i);
    expect(editor).toMatch(/deleteConfirmation !== "CONFIRM"/);
  });

  it("keeps historical order snapshots when a product is deleted", () => {
    expect(migration).toMatch(/order_items_product_id_fkey[\s\S]*on delete set null/i);
  });

  it("uses the canonical brand page from a locked category", () => {
    expect(catalogBrowser).toMatch(/if \(slug && locked\?\.category\)/);
    expect(catalogBrowser).toMatch(/router\.push\(`\/brands\/\$\{encodeURIComponent\(slug\)\}`\)/);
    expect(catalogBrowser).toMatch(/if \(locked\?\.brand\)/);
    expect(catalogBrowser).toMatch(/if \(locked\?\.category\)/);
    expect(catalogBrowser).toMatch(/router\.push\(slug \? `\/categories/);
  });

  it("applies every customer-facing filter and sort in the live catalog", () => {
    expect(liveCatalog).toMatch(/pq\.dietary/);
    expect(liveCatalog).toMatch(/pq\.price_min/);
    expect(liveCatalog).toMatch(/pq\.price_max/);
    expect(liveCatalog).toMatch(/pq\.sort === "price_asc"/);
    expect(liveCatalog).toMatch(/pq\.sort === "discount"/);
    expect(liveCatalog).toMatch(/new Set\(\["category"\]\)/);
    expect(liveCatalog).toMatch(/new Set\(\["form"\]\)/);
    expect(catalogApi).toMatch(/products\/filters\$\{toQuery/);
    expect(apiRoute).toMatch(/repo\.filters\(productQuery\(sp\)\)/);
  });

  it("paginates Supabase reads past the 1,000-row response cap", () => {
    expect(liveCatalog).toMatch(/SUPABASE_PAGE_SIZE = 1000/);
    expect(liveCatalog).toMatch(/fetchAllSupabaseRows/);
    expect(liveCatalog).toMatch(/\.range\(from, to\)/);
    expect(liveCatalog).toMatch(/page\.length < SUPABASE_PAGE_SIZE/);
  });

  it("publishes only sellable brands with reviewed logo assets", () => {
    expect(liveCatalog).toMatch(/logo_path,website_url/);
    expect(liveCatalog).toMatch(/productCounts/);
    expect(liveCatalog).toMatch(/brand\.product_count > 0/);
    expect(brandLogoMigration).toMatch(/\/brand-logos\/garden-of-life\.png/);
    expect(brandLogoMigration).toMatch(/where brand\.slug = source\.slug/);
  });

  it("removes only the normalized Nature's Plus brand identity", () => {
    expect(cleanupMigration).toMatch(/naturesplus/i);
    expect(cleanupMigration).toMatch(/delete from public\.products/i);
    expect(cleanupMigration).not.toMatch(/naturesway/i);
  });
});

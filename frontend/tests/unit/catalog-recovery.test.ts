import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const migration = read("../supabase/migrations/20260914183000_catalog_recovery_product_delete.sql");
const apiRoute = read("src/app/api/v1/[...path]/route.ts");
const editor = read("src/components/admin/product-editor.tsx");
const catalogBrowser = read("src/components/catalog/catalog-browser.tsx");

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
  });
});

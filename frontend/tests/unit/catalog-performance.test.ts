import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");
const catalog = read("src/lib/data/supabase-catalog.ts");
const apiRoute = read("src/app/api/v1/[...path]/route.ts");
const importCommitRoute = read("src/app/api/admin/catalog-imports/[batchId]/commit/route.ts");
const importDeleteRoute = read("src/app/api/admin/catalog-imports/[batchId]/route.ts");
const imageRoute = read("src/app/api/admin/products/[productId]/image/route.ts");

describe("live catalog performance", () => {
  it("coalesces full-catalog reads and caches small endpoint results", () => {
    expect(catalog).toMatch(/activeProductsRequest/);
    expect(catalog).toMatch(/ACTIVE_PRODUCTS_MEMORY_TTL_MS/);
    expect(catalog).toMatch(/unstable_cache/);
    expect(catalog).toMatch(/catalog-product-page-v1/);
    expect(catalog).toMatch(/catalog-filters-v1/);
  });

  it("loads a product detail directly instead of scanning the full catalog", () => {
    expect(catalog).toMatch(/\.eq\("slug", slug\)[\s\S]*\.maybeSingle\(\)/);
    expect(catalog).toMatch(/catalog-related-products-v1/);
  });

  it("invalidates cached catalog results after every live catalog mutation", () => {
    expect(apiRoute).toMatch(/revalidateTag\(CATALOG_CACHE_TAG, \{ expire: 0 \}\)/);
    expect(importCommitRoute).toMatch(/revalidateTag\(CATALOG_CACHE_TAG, \{ expire: 0 \}\)/);
    expect(importDeleteRoute).toMatch(/revalidateTag\(CATALOG_CACHE_TAG, \{ expire: 0 \}\)/);
    expect(imageRoute).toMatch(/revalidateTag\(CATALOG_CACHE_TAG, \{ expire: 0 \}\)/);
  });
});

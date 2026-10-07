import { describe, expect, it } from "vitest";
import { canBrowseInDatabase } from "@/lib/data/catalog-browse-query";
describe("catalog pagination fast path", () => {
  it("paginates ordinary, brand, category and sale browsing", () => {
    for (const query of [{}, { brand: "nordic-naturals" }, { category: "herbs" }, { on_sale: true }, { is_new: false }, { sort: "newest", page: 2 }]) expect(canBrowseInDatabase(query)).toBe(true);
  });
  it("preserves established search, advanced-filter and pricing semantics", () => {
    for (const query of [{ q: "sleep" }, { form: "capsule" }, { availability: "low_stock" }, { dietary: ["vegan"] }, { price_min: 0 }, { price_max: 999 }, { sort: "price_asc" }, { sort: "discount" }]) expect(canBrowseInDatabase(query)).toBe(false);
  });
});

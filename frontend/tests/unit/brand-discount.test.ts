import { beforeEach, describe, expect, it } from "vitest";
import {
  listBrands,
  listProducts,
  resetDemoStore,
  updateBrand,
} from "@/lib/demo-store/engine";
import { saleFromPercent } from "@/lib/money";

describe("brand discount pricing", () => {
  beforeEach(() => {
    resetDemoStore();
  });

  it("recalculates Store SRP for every product in the brand", () => {
    const brand = listBrands().find((item) => typeof item.id === "number");
    expect(brand).toBeDefined();

    updateBrand(brand!.id as number, { discount_percent: 25 });
    const products = listProducts({ brand: brand!.slug, page_size: 100 }).items;

    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      expect(product.sale_price_cents).toBe(
        saleFromPercent(product.regular_price_cents, 25),
      );
      expect(product.discount_percent).toBe(25);
    }
  });

  it("clears Store SRP when the brand discount is zero", () => {
    const brand = listBrands().find((item) => typeof item.id === "number")!;
    updateBrand(brand.id as number, { discount_percent: 25 });
    updateBrand(brand.id as number, { discount_percent: 0 });

    const products = listProducts({ brand: brand.slug, page_size: 100 }).items;
    expect(products.every((product) => product.sale_price_cents == null)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { discountPercent, effectivePriceCents, parseDollarsToCents, saleFromPercent } from "@/lib/money";

describe("money", () => {
  it("parses dollars to integer cents", () => {
    expect(parseDollarsToCents("19.99")).toBe(1999);
    expect(parseDollarsToCents("$1,200.50")).toBe(120050);
  });

  it("derives discount percent", () => {
    expect(discountPercent(2000, 1500)).toBe(25);
    expect(discountPercent(2000, null)).toBeNull();
  });

  it("computes sale from percent with a 99-cent ending", () => {
    expect(saleFromPercent(2000, 25)).toBe(1499);
    expect(saleFromPercent(2960, 20)).toBe(2399);
    expect(saleFromPercent(2936, 20)).toBe(2299);
    expect(saleFromPercent(2500, 10)).toBe(2299);
    expect(effectivePriceCents(2000, 1499)).toBe(1499);
  });
});

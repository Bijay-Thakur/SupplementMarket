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

  it("computes sale from percent without float totals", () => {
    expect(saleFromPercent(2000, 25)).toBe(1500);
    expect(effectivePriceCents(2000, 1500)).toBe(1500);
  });
});

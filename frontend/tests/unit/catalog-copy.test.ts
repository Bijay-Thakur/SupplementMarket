import { describe, expect, it } from "vitest";
import { canAddToCart } from "@/lib/catalog-copy";

describe("catalog purchase availability", () => {
  it.each(["in_stock", "low_stock", "special_order"])(
    "allows %s products to be added to the cart",
    (availability) => {
      expect(canAddToCart(availability)).toBe(true);
    },
  );

  it.each(["out_of_stock", "discontinued", "coming_soon"])(
    "keeps %s products unavailable",
    (availability) => {
      expect(canAddToCart(availability)).toBe(false);
    },
  );
});

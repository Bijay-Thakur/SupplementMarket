import { describe, it, expect } from "vitest";
import { cartSubtotalCents, type CartItem } from "@/lib/cart/storage";

describe("cart", () => {
  it("subtotals in integer cents", () => {
    const items: CartItem[] = [
      {
        productId: 1,
        slug: "a",
        name: "A",
        brandName: "B",
        quantity: 2,
        unitPriceCents: 1499,
        availability: "in_stock",
        imageUrl: null,
      },
    ];
    expect(cartSubtotalCents(items)).toBe(2998);
  });
});

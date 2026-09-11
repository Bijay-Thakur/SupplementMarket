import { beforeEach, describe, expect, it } from "vitest";
import { CART_STORAGE_KEY, CART_VERSION, loadCart, saveCart } from "@/lib/cart/storage";

describe("guest cart storage", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and removes carts left by the demo storefront", () => {
    localStorage.setItem(
      "bnm-cart-v2",
      JSON.stringify({ version: 2, items: [{ productId: 1, quantity: 4 }] }),
    );

    expect(loadCart()).toEqual({ version: CART_VERSION, items: [] });
    expect(localStorage.getItem("bnm-cart-v2")).toBeNull();
  });

  it("persists only items a customer adds to the current cart", () => {
    saveCart({
      version: CART_VERSION,
      items: [
        {
          productId: "product-1",
          slug: "product-1",
          name: "Product 1",
          brandName: "Brand",
          quantity: 1,
          unitPriceCents: 1299,
          availability: "in_stock",
          imageUrl: null,
        },
      ],
    });

    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull();
    expect(loadCart().items).toHaveLength(1);
  });
});

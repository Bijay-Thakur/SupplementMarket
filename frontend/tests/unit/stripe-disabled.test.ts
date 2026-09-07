import { describe, expect, it } from "vitest";
import { createOrder, resetDemoStore } from "@/lib/demo-store/engine";

describe("stripe-disabled checkout", () => {
  it("refuses card payment on the snapshot order API", () => {
    resetDemoStore();
    expect(() =>
      createOrder({
        user_id: "00000000-0000-4000-a000-000000000001",
        payment_method: "card",
        customer_name: "Test",
        customer_email: "t@example.com",
        customer_phone: "555-0100",
        items: [{ product_id: 54, quantity: 1 }],
      }),
    ).toThrow(/not available/i);
  });
});

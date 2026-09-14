import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260910234500_order_requests.sql"),
  "utf8",
);
const apiRoute = readFileSync(
  path.join(process.cwd(), "src/app/api/v1/[...path]/route.ts"),
  "utf8",
);
const checkout = readFileSync(
  path.join(process.cwd(), "src/app/(store)/checkout/checkout-form.tsx"),
  "utf8",
);
const lifecycleMigration = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260914020000_import_delete_order_lifecycle.sql"),
  "utf8",
);
const importDeleteRoute = readFileSync(
  path.join(process.cwd(), "src/app/api/admin/catalog-imports/[batchId]/route.ts"),
  "utf8",
);

describe("durable call-to-confirm orders", () => {
  it("stores UUID catalog references and denies browser table access", () => {
    expect(migration).toMatch(/product_id uuid references public\.products\(id\)/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.orders from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.submit_order_request[\s\S]*to service_role/i);
  });

  it("calculates item prices from active product variants in the transaction", () => {
    expect(migration).toMatch(/from public\.product_variants/i);
    expect(migration).toMatch(/v_unit_price := case/i);
    expect(migration).toMatch(/v_subtotal := v_subtotal \+ \(v_unit_price::bigint \* v_quantity\)/i);
    expect(migration).not.toMatch(/p_(unit_)?price/i);
  });

  it("requires same-origin authenticated requests and uses the database provider", () => {
    expect(apiRoute).toMatch(/if \(key === "orders"\)[\s\S]*requireSameOrigin\(req\)[\s\S]*requireUser\(req\)/);
    expect(apiRoute).toMatch(/submitOrderRequest\(body, user\)/);
    expect(apiRoute).toMatch(/getCustomerOrder\(path\[1\], user\.id\)/);
    expect(apiRoute).toMatch(/listAdminOrders/);
  });

  it("offers call-to-confirm and no card-payment control", () => {
    expect(checkout).toMatch(/Please call the store/);
    expect(checkout).toMatch(/No online payment was taken/);
    expect(checkout).not.toMatch(/Stripe Checkout/);
    expect(checkout).not.toMatch(/type="radio" name="payment"/);
  });

  it("requires an address only for delivery", () => {
    expect(migration).toMatch(/if p_fulfillment_type = 'delivery' and/i);
    expect(checkout).toMatch(/fulfillment === "delivery"/);
    expect(checkout).toMatch(/fulfillment === "delivery" \? form\.address_line1 : ""/);
  });

  it("supports secure lifecycle updates and durable admin notifications", () => {
    expect(lifecycleMigration).toMatch(/payment_status in \('unpaid', 'paid'\)/i);
    expect(lifecycleMigration).toMatch(/'shipped'[\s\S]*'delivered'/i);
    expect(lifecycleMigration).toMatch(/admin_seen_at/i);
    expect(apiRoute).toMatch(/listAdminOrderNotifications/);
    expect(apiRoute).toMatch(/markAdminOrderSeen/);
  });

  it("triple-checks destructive import deletion", () => {
    expect(importDeleteRoute).toMatch(/requireAdmin/);
    expect(importDeleteRoute).toMatch(/assertSameOrigin/);
    expect(importDeleteRoute).toMatch(/confirmation !== "CONFIRM"/);
    expect(lifecycleMigration).toMatch(/p_confirmation is distinct from 'CONFIRM'/i);
    expect(lifecycleMigration).toMatch(/detected_action = 'insert'/i);
    expect(lifecycleMigration).toMatch(/product\.data_source = 'csv_import'/i);
  });
});

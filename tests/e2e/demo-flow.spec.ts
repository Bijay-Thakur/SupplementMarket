import { test, expect } from "@playwright/test";

test.describe("Phase 2 local demo flow", () => {
  test("customer search, cart, pickup order, then admin price change", async ({ page }) => {
    await page.goto("/");
    const chooser = page.getByRole("dialog", { name: /Welcome to Bronxville Natural Market/i });
    if (await chooser.isVisible()) {
      await page.getByRole("button", { name: "Continue as Customer" }).click();
    }

    await page.getByLabel("Search products").first().fill("turmeric");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/q=turmeric/);
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("article").first().locator("a[href^='/products/']").first().click();
    await expect(page).toHaveURL(/\/products\/.+/);
    await page.getByRole("button", { name: "Add to cart" }).first().click();

    await page.goto("/cart");
    await page.getByRole("link", { name: "Checkout" }).click();
    await page.getByLabel(/Name/).fill("Bijay Demo");
    await page.getByLabel(/Email/).fill("bijay@example.com");
    await page.getByLabel(/Phone/).fill("555-0100");
    await page.getByRole("button", { name: /Submit demo order request/i }).click();
    await expect(page.getByText(/Order request received/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/BNM-/)).toBeVisible();

    await page.getByRole("button", { name: "Switch role" }).click();
    await page.getByRole("button", { name: "Continue as Admin" }).click();
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/orders");
    await expect(page.getByText(/Bijay Demo|BNM-/).first()).toBeVisible({ timeout: 15_000 });

    await page.goto("/admin/products");
    await page.getByPlaceholder("Search name, SKU, brand").fill("Zinc Gummies");
    await page.getByRole("link", { name: /Zinc Gummies/i }).first().click();
    await page.getByLabel("Regular price ($)").fill("21.00");
    await page.getByLabel("Sale price ($)").fill("");
    await page.getByRole("button", { name: "Save product" }).click();

    await page.getByRole("button", { name: "Switch role" }).click();
    await page.getByRole("button", { name: "Continue as Customer" }).click();
    await page.goto("/products?q=Zinc%20Gummies");
    await expect(page.getByText("$21.00").first()).toBeVisible({ timeout: 15_000 });
  });

  test("admin catalog import review table loads", async ({ page }) => {
    await page.goto("/admin/catalog-imports");
    const chooser = page.getByRole("dialog", { name: /Welcome to Bronxville Natural Market/i });
    if (await chooser.isVisible()) {
      await page.getByRole("button", { name: "Continue as Admin" }).click();
    }
    await expect(page.getByRole("heading", { name: /Brand catalog imports/i })).toBeVisible({ timeout: 15_000 });
    await page.goto("/admin/catalog-imports/sources");
    await expect(page.getByRole("heading", { name: /Catalog sources/i })).toBeVisible();
    await expect(page.getByText("NOW Foods")).toBeVisible({ timeout: 15_000 });
  });
});

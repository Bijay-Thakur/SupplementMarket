import { test, expect } from "@playwright/test";
import path from "node:path";

const shot = (name: string) => path.join(process.cwd(), ".screenshots", name);

test.describe("Phase 2B catalog import screenshots", () => {
  test("capture import review, admin products, and storefront", async ({ page }) => {
    await page.goto("/admin/catalog-imports");
    const chooser = page.getByRole("dialog", { name: /Welcome to Bronxville Natural Market/i });
    if (await chooser.isVisible()) {
      await page.getByRole("button", { name: "Continue as Admin" }).click();
    }
    await expect(page.getByRole("heading", { name: /Brand catalog imports/i })).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: shot("p2b-import-runs.png"), fullPage: true });

    await page.goto("/admin/catalog-imports/sources");
    await expect(page.getByText("NOW Foods")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: shot("p2b-catalog-sources.png"), fullPage: true });

    await page.goto("/admin/catalog-imports");
    const runLink = page.locator("table a[href*='/admin/catalog-imports/']").first();
    await expect(runLink).toBeVisible({ timeout: 15_000 });
    await runLink.click();
    await expect(page.getByText(/Demo pricing/i).first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: shot("p2b-import-review-table.png"), fullPage: true });

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: /Products/i })).toBeVisible();
    await page.getByPlaceholder("Search name, SKU, brand").fill("Nature");
    await page.waitForTimeout(800);
    await page.screenshot({ path: shot("p2b-admin-products-imported.png"), fullPage: true });

    await page.goto("/");
    await page.getByRole("button", { name: "Switch role" }).click().catch(() => {});
    const customer = page.getByRole("button", { name: "Continue as Customer" });
    if (await customer.isVisible()) await customer.click();
    await page.goto("/products?brand=nature-s-way");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: shot("p2b-storefront-real-brands.png"), fullPage: true });
  });
});

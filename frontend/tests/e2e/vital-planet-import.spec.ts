import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

function loadRootEnv() {
  const envPath = path.resolve(__dirname, "../../../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1);
    if (process.env[key] == null) process.env[key] = value;
  }
}

loadRootEnv();

const csvPath = path.resolve(__dirname, "../../../docs/Vital Planet Order Form 9.2.26.csv");

test.describe("Vital Planet CSV import", () => {
  test("imports the order form, shows a storefront product, and blocks unapproved duplicate updates", async ({ page }) => {
    test.skip(
      process.env.DATA_PROVIDER !== "supabase" || !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
      "Requires DATA_PROVIDER=supabase and E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.",
    );
    test.skip(!fs.existsSync(csvPath), "Vital Planet fixture is missing.");

    await page.goto("/admin/login");
    if (page.url().includes("/admin/login")) {
      await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL!);
      await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /sign in/i }).click();
    }

    await page.goto("/admin/products/import");
    await expect(page.getByRole("heading", { name: /Import products/i })).toBeVisible();
    await page.locator("input[type=file]").setInputFiles(csvPath);
    await page.getByRole("button", { name: "Analyze CSV" }).click();
    await expect(page.getByText(/Column mapping/i)).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/Default brand/).fill("Vital Planet");
    await page.getByLabel("Default discount").selectOption("20");
    await page.getByRole("button", { name: /Generate review/i }).click();
    await expect(page.getByText(/total detected/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Approve and import/i }).click();
    await expect(page.getByText(/Inserted/i)).toBeVisible({ timeout: 60_000 });

    await page.goto("/admin/products");
    await page.getByPlaceholder(/Search name/).fill("Vital Flora");
    await expect(page.getByRole("link", { name: /Vital Flora/i }).first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/products?q=Vital%20Flora");
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/admin/products/import");
    await page.locator("input[type=file]").setInputFiles(csvPath);
    await page.getByRole("button", { name: "Analyze CSV" }).click();
    await page.getByRole("button", { name: /Generate review/i }).click();
    await expect(page.getByText(/imported before/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/existing products are blocked/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve existing-product update/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve and import/i })).toBeDisabled();
  });
});

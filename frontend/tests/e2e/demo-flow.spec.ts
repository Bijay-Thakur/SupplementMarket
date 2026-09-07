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

async function signInAdmin(page: import("@playwright/test").Page) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin e2e.");
  if (!page.url().includes("/admin/login")) return;
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("admin catalog operations", () => {
  test("admin can change a product price after signing in", async ({ page }) => {
    await page.goto("/admin/login");
    await signInAdmin(page);
    await expect(page).toHaveURL(/\/admin/);
    await page.goto("/admin/products");
    await page.getByPlaceholder(/Search name/).fill("Zinc Gummies");
    await page.getByRole("link", { name: /Zinc Gummies/i }).first().click();
    await page.getByLabel("Regular price ($)").fill("21.00");
    await page.getByLabel("Sale price ($)").fill("");
    await page.getByRole("button", { name: "Save product" }).click();
  });

  test("admin catalog import review table loads", async ({ page }) => {
    await page.goto("/admin/login");
    await signInAdmin(page);
    await page.goto("/admin/catalog-imports");
    await expect(page.getByRole("heading", { name: /Brand catalog imports/i })).toBeVisible({ timeout: 15_000 });
    await page.goto("/admin/catalog-imports/sources");
    await expect(page.getByRole("heading", { name: /Catalog sources/i })).toBeVisible();
    await expect(page.getByText("NOW Foods")).toBeVisible({ timeout: 15_000 });
  });
});

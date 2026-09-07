import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { SAMPLE_CATALOG_NOTICE } from "../../src/lib/catalog/sample-notice";

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

async function continueAsGuest(page: import("@playwright/test").Page) {
  const chooser = page.getByRole("dialog", { name: /How would you like to continue/i });
  await expect(chooser).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: /Continue as Guest/i }).click();
  await expect(chooser).toHaveCount(0);
}

test.describe("entry modes", () => {
  test("unauthenticated visitor opening / sees three options", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: /How would you like to continue/i });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue as Guest/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue as Customer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue as Admin/i })).toBeVisible();
    await expect(page.getByText(/Demo mode/i)).toHaveCount(0);
    await expect(page.getByText(/Demonstration catalog/i)).toHaveCount(0);
  });

  test("guest enters the storefront without creating an account", async ({ page }) => {
    await page.goto("/");
    await continueAsGuest(page);
    await expect(page.getByRole("link", { name: "Sign In" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Account" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /view cart/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Vitamins & natural supplements/i })).toBeVisible();
  });

  test("customer selection opens customer authentication", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue as Customer/i }).click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    await expect(page.getByRole("heading", { name: /^Sign in$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Create an account/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toHaveCount(0);
  });

  test("admin selection opens administrator authentication", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Continue as Admin/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /Admin sign in/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toHaveCount(0);
    await expect(page.getByText(/Shop the catalog/i)).toHaveCount(0);
  });

  test("sessionStorage admin cannot open the storefront or /admin", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("bronxville-entry-mode-v3", "admin");
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /Vitamins & natural supplements/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /view cart/i })).toHaveCount(0);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("storefront after guest entry", () => {
  test("guest can browse products and sample-data disclosure is catalog-only", async ({ page }) => {
    await page.goto("/");
    await continueAsGuest(page);
    await expect(page.getByText(SAMPLE_CATALOG_NOTICE)).toHaveCount(0);
    await expect(page.getByText(/Demonstration catalog/i)).toHaveCount(0);

    await page.goto("/products");
    await expect(page.getByText(SAMPLE_CATALOG_NOTICE).first()).toBeVisible();
    await expect(page.getByRole("article").first()).toBeVisible({ timeout: 15_000 });
  });

  test("guest and sessionStorage cannot open /admin", async ({ page }) => {
    await page.goto("/");
    await continueAsGuest(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /Admin sign in/i })).toBeVisible();
  });

  test("checkout requires sign-in before an order can be placed", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: /Sign in to place an order/i })).toBeVisible();
    await expect(page.locator("#main-content").getByRole("link", { name: "Sign In" })).toBeVisible();
    await expect(page.locator("#main-content").getByRole("link", { name: "Create Account" })).toBeVisible();
  });
});

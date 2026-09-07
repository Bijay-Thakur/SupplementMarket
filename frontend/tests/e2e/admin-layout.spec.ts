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
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/admin(?:\/(?:$|\?.*))?$/, { timeout: 20_000 });
}

test.describe("administrator layout", () => {
  test("admin login redirects directly to /admin without storefront chrome", async ({ page }) => {
    await signInAdmin(page);
    await expect(page.getByText(/administrator/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view cart/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "My Account" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Products", exact: true })).toBeVisible();
    await expect(page.getByText(/Vitamins & natural supplements/i)).toHaveCount(0);
    await expect(page.getByText(/Demonstration catalog/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /\+1 \(914\)/ })).toHaveCount(0);
  });

  test("authenticated admin opening / redirects to /admin", async ({ page }) => {
    await signInAdmin(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/admin(?:\/(?:$|\?.*))?$/, { timeout: 15_000 });
    await expect(page.getByText(/administrator/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Vitamins & natural supplements/i })).toHaveCount(0);
  });

  test("admin sign-out returns to the entry selector and locks /admin", async ({ page }) => {
    await signInAdmin(page);
    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page).toHaveURL(/\/(?:$|\?)/, { timeout: 20_000 });
    await expect(page.getByRole("dialog", { name: /How would you like to continue/i })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

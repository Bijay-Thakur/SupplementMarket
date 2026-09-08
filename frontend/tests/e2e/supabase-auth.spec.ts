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

test.describe("Supabase authentication", () => {
  test("unauthenticated visitors cannot open /admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login|\/auth\/sign-in/);
  });

  test("administrator can sign in, reach /admin, then sign out", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.");

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 20_000 });
    await expect(page.getByText(/administrator/i).first()).toBeVisible();

    await page.getByRole("button", { name: /sign out/i }).first().click();
    await expect(page.getByRole("dialog", { name: /How would you like to continue/i })).toBeVisible({ timeout: 20_000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login|\/auth\/sign-in/);
  });

  test("customer cannot access administrator pages", async ({ page }) => {
    const email = process.env.E2E_CUSTOMER_EMAIL;
    const password = process.env.E2E_CUSTOMER_PASSWORD;
    test.skip(!email || !password, "Set E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD to run this test.");

    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/account|\/admin/, { timeout: 20_000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/forbidden|\/admin\/login/, { timeout: 20_000 });
    if (page.url().includes("/admin/login")) {
      await page.getByLabel("Email").fill(email!);
      await page.getByLabel("Password").fill(password!);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      await expect(page.getByText(/does not have administrator access/i)).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByText(/does not have administrator access|access denied/i)).toBeVisible();
    }

    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Account menu$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /view cart/i })).toBeVisible();
    await page.getByRole("button", { name: /^Account menu$/i }).click();
    await expect(page.getByRole("menuitem", { name: "My Account" })).toBeVisible();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page.getByRole("dialog", { name: /How would you like to continue/i })).toBeVisible({ timeout: 20_000 });
  });
});

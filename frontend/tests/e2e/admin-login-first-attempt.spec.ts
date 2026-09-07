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

test.describe("first-attempt administrator login", () => {
  test("succeeds on the first submission without refresh or a second credential request", async ({
    page,
    context,
  }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run this test.");

    const sessionPosts: string[] = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      const url = req.url();
      if (url.includes("/api/auth/session")) sessionPosts.push(url);
    });

    await context.clearCookies();
    await page.goto("/admin/login");

    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/admin(?:\/(?:$|\?.*))?$/, { timeout: 20_000 });
    await expect(page.getByText(/administrator/i).first()).toBeVisible();
    expect(sessionPosts.length).toBe(1);

    const cookies = await context.cookies();
    expect(cookies.some((cookie) => /sb-.*auth-token|supabase/i.test(cookie.name) || cookie.name.includes("sb-"))).toBe(
      true,
    );
  });

  test("rejects invalid administrator credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill("not-an-admin@example.com");
    await page.getByLabel("Password").fill("wrong-password-1");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText(/could not complete sign-in/i)).toBeVisible({ timeout: 15_000 });
  });
});

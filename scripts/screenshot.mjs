import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = ".screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: "networkidle" });
const chooser = page.getByRole("dialog", { name: /Welcome to Bronxville Natural Market/i });
if (await chooser.isVisible().catch(() => false)) {
  await page.getByRole("button", { name: "Continue as Customer" }).click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${outDir}/p2-home.png`, fullPage: true });

await page.goto(`${base}/products`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/p2-catalog.png`, fullPage: true });

await page.evaluate(() => localStorage.setItem("bnm-demo-role", "admin"));
await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/p2-admin.png`, fullPage: true });

await page.goto(`${base}/admin/products`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/p2-admin-products.png`, fullPage: true });

console.log("captured phase 2 screenshots");
await browser.close();

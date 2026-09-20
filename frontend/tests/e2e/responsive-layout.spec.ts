import { expect, test } from "@playwright/test";

const viewports = [
  { name: "small phone", width: 320, height: 700 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
  { name: "large desktop", width: 1920, height: 1080 },
  { name: "ultrawide desktop", width: 2560, height: 1440 },
];

test.describe("responsive storefront", () => {
  test("mobile menu covers the viewport and remains scrollable on a short screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 568 });
    await page.goto("/products");
    await page.getByRole("button", { name: "Open menu" }).click();

    const dialog = page.getByRole("dialog", { name: "Site menu" });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).toMatchObject({ x: 0, y: 0, width: 390, height: 568 });
    await dialog.getByRole("link", { name: "Create Account" }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("link", { name: "Create Account" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");
  });

  for (const width of [320, 390, 528]) {
    test(`product images stay compact at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto("/products");
      const grid = page.locator("#main-content .catalog-product-grid");
      const firstCard = grid.locator("article").first();
      await expect(firstCard).toBeVisible();
      const image = firstCard.locator("img, [role='img']").first();
      const imageBounds = await image.boundingBox();
      expect(imageBounds?.height).toBeLessThanOrEqual(161);
      const columns = await grid.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(" ").length,
      );
      expect(columns).toBe(width < 380 ? 1 : 2);
    });
  }

  for (const viewport of viewports) {
    test(`catalog stays within the ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/products");
      await expect(page.locator("#main-content")).toBeVisible();

      await expect
        .poll(() =>
          page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          })),
        )
        .toEqual({ clientWidth: viewport.width, scrollWidth: viewport.width });

      if (viewport.width >= 1440) {
        const gutters = await page.locator("#main-content h1").first().evaluate((heading) => {
          const bounds = heading.getBoundingClientRect();
          return { left: bounds.left, right: window.innerWidth - bounds.right };
        });
        expect(gutters.left).toBeLessThanOrEqual(40);
        expect(gutters.right).toBeLessThanOrEqual(40);
      }

      const elementsOutsideViewport = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .filter((element) => {
            if (!element.offsetParent || element.classList.contains("sr-only")) return false;
            if (element.closest("[class*='overflow-x-auto']")) return false;
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && (bounds.left < -1 || bounds.right > window.innerWidth + 1);
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: element.className.toString(),
          })),
      );
      expect(elementsOutsideViewport).toEqual([]);
    });
  }

  for (const width of [320, 768, 1920, 2560]) {
    test(`home and brand directory fit within ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const guestChoice = page.getByRole("button", { name: /Continue as Guest/ });
      if (await guestChoice.isVisible()) await guestChoice.click();
      for (const path of ["/", "/brands"]) {
        await page.goto(path);
        await expect(page.locator("#main-content")).toBeVisible();
        if (path === "/brands") {
          await expect(page.locator("#main-content ul li").first()).toBeVisible();
        }
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBe(width);
      }
    });
  }
});

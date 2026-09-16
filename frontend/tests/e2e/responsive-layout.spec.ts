import { expect, test } from "@playwright/test";

const viewports = [
  { name: "small phone", width: 320, height: 700 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "small laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide desktop", width: 1440, height: 900 },
];

test.describe("responsive storefront", () => {
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
});

import { expect, test } from "@playwright/test";

test.describe("catalog search navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/products/suggestions**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              type: "category",
              name: "Protein",
              slug: "protein",
              href: "/categories/protein",
            },
            {
              type: "product",
              name: "RAW Protein and Greens",
              slug: "raw-protein-and-greens",
              href: "/products/raw-protein-and-greens",
              brand_name: "Garden of Life",
            },
          ],
        }),
      });
    });
    await page.goto("/products");
  });

  test("Enter searches the full catalog instead of opening the first suggestion", async ({ page }) => {
    const search = page.getByRole("combobox", { name: "Search products" }).first();
    await search.fill("Protein");
    await expect(page.getByRole("option", { name: /category\s*Protein/i })).toBeVisible();

    await search.press("Enter");

    await expect(page).toHaveURL(/\/products\?q=Protein$/);
  });

  test("a category suggestion opens the category results page", async ({ page }) => {
    const search = page.getByRole("combobox", { name: "Search products" }).first();
    await search.fill("Protein");
    await page.getByRole("option", { name: /category\s*Protein/i }).click();

    await expect(page).toHaveURL(/\/categories\/protein$/);
  });

  test("new popular shortcuts open their live product results", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Popular product categories" });
    for (const [label, query] of [
      ["Kids' Health", "kids health"],
      ["Pets", "pet"],
      ["Protein", "protein"],
    ]) {
      const link = nav.getByRole("link", { name: label });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(query)}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(page.locator("main article").first()).toBeVisible();
    }
    await expect(page).toHaveURL(/\?q=protein$/);
    const healthLink = nav.getByRole("link", { name: "Men & Women Health" });
    await healthLink.click();
    await expect(page).toHaveURL(/\/categories\/men-women-health$/);
    await expect(healthLink).toHaveAttribute("aria-current", "page");
  });
});

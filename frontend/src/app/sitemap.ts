import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env/public";
import { catalogRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

const STATIC_ROUTES = [
  "",
  "/products",
  "/brands",
  "/sales",
  "/new",
  "/about",
  "/requests",
  "/shipping-pickup",
  "/returns",
  "/privacy",
  "/terms",
  "/accessibility",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, "");
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  try {
    const repo = catalogRepository();
    const [brands, categories, firstPage] = await Promise.all([
      Promise.resolve(repo.listBrands()),
      Promise.resolve(repo.listCategories()),
      Promise.resolve(repo.listProducts({ page: 1, page_size: 100 })),
    ]);
    for (const brand of brands) {
      if (brand.slug) entries.push({ url: `${base}/brands/${brand.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const category of categories) {
      if (category.slug) entries.push({ url: `${base}/categories/${category.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const product of firstPage.items) {
      if (product.slug) entries.push({ url: `${base}/products/${product.slug}`, lastModified: now, changeFrequency: "weekly", priority: 0.5 });
    }
  } catch {
    /* Static routes still publish if the catalog is temporarily unavailable. */
  }

  return entries;
}

import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env/public";

/**
 * Static public routes. Dynamic product/brand/category entries are appended in
 * Phase 3 once the catalog data source exists.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicEnv.siteUrl;
  const routes = [
    "",
    "/products",
    "/brands",
    "/sales",
    "/new",
    "/about",
    "/shipping-pickup",
    "/returns",
    "/privacy",
    "/terms",
    "/accessibility",
  ];
  const now = new Date();
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}

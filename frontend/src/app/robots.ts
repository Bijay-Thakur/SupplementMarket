import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env/public";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/auth", "/checkout", "/order", "/api"],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}

import { Suspense } from "react";
import { permanentRedirect } from "next/navigation";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

const LEGACY_GENDER_HEALTH_SLUGS = new Set([
  "sexual-wellness",
  "men",
  "men-s-health",
  "men-s-multis",
  "men-s-wellness",
  "women",
  "women-s",
  "women-s-formulas",
  "women-s-health",
  "women-s-health-hormone-creams",
  "women-s-multis",
  "women-s-wellness",
  "prenatal-postnatal",
  "baby-me-2",
]);

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (LEGACY_GENDER_HEALTH_SLUGS.has(slug)) {
    permanentRedirect("/categories/men-women-health");
  }
  const title = slug === "men-women-health" ? "Men & Women Health" : slug.replaceAll("-", " ");
  return (
    <Suspense>
      <CatalogBrowser
        title={title}
        locked={{ category: slug }}
      />
    </Suspense>
  );
}

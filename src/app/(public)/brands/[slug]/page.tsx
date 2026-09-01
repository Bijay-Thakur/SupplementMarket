import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense>
      <CatalogBrowser
        title={`Brand: ${slug.replaceAll("-", " ")}`}
        description="Demonstration products for this brand."
        locked={{ brand: slug }}
      />
    </Suspense>
  );
}

import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense>
      <CatalogBrowser
        title={slug.replaceAll("-", " ")}
        locked={{ category: slug }}
      />
    </Suspense>
  );
}

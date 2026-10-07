import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Products",
  "Browse vitamins, herbs, and natural supplements. Filter by brand, category, and price.",
  "/products",
);

export default function ProductsPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="Product catalog"
        description="Browse vitamins and supplements. Filters stay in the URL so you can share them."
      />
    </Suspense>
  );
}

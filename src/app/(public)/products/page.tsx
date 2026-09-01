import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="Product catalog"
        description="Browse demonstration vitamins and supplements. Filters stay in the URL so you can share them."
      />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="Current sales"
        description="Products currently marked on sale. End dates and live promotions are owner-configured."
        locked={{ on_sale: true }}
      />
    </Suspense>
  );
}

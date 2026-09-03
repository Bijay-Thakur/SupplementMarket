import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="Current sales"
        description="Demonstration sale prices. End dates and live promotions are owner-configured later."
        locked={{ on_sale: true }}
      />
    </Suspense>
  );
}

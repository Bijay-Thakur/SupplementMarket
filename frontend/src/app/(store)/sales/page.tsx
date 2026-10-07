import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Sales",
  "See supplements currently marked on sale at Bronxville Natural Market.",
  "/sales",
);

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

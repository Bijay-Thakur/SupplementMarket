import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "New Arrivals",
  "New vitamins and natural supplements at Bronxville Natural Market.",
  "/new",
);

export default function NewPage() {
  return (
    <Suspense>
      <CatalogBrowser
        title="New arrivals"
        description="Products flagged as new arrivals."
        locked={{ is_new: true }}
      />
    </Suspense>
  );
}

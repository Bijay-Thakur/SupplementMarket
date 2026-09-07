import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";

export const metadata: Metadata = { title: "New Arrivals" };

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

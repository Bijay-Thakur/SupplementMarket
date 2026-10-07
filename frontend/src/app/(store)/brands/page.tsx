import { BrandsDirectory } from "@/components/catalog/brands-directory";
import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Brands",
  "Shop vitamins and supplements by brand at Bronxville Natural Market.",
  "/brands",
);

export default function BrandsPage() {
  return <BrandsDirectory />;
}

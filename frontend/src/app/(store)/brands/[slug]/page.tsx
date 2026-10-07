import { Suspense } from "react";
import type { Metadata } from "next";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { SITE_NAME } from "@/lib/seo/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replaceAll("-", " ");
  return {
    title: name,
    description: `Browse ${name} products at ${SITE_NAME}.`,
    alternates: { canonical: `/brands/${slug}` },
  };
}

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
        description="Products from this brand."
        locked={{ brand: slug }}
      />
    </Suspense>
  );
}

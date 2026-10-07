import type { Metadata } from "next";
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
    description: `${name} at ${SITE_NAME}. Product details and pricing are sample data until the store verifies them.`,
    alternates: { canonical: `/products/${slug}` },
  };
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}

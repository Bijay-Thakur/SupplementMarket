import { pageMetadata } from "@/lib/seo/site";

export const metadata = pageMetadata(
  "Special Requests",
  "Ask Bronxville Natural Market to look for a supplement that is not in the catalog.",
  "/requests",
);

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

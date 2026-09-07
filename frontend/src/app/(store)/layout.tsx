import { StoreShell } from "@/components/layout/store-shell";

/**
 * Public storefront layout. Administrators are redirected to /admin before
 * this chrome renders. Auth and admin routes use other route groups.
 */
export default async function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StoreShell>{children}</StoreShell>;
}

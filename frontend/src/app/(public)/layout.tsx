import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { StoreAnnouncement } from "@/components/layout/store-announcement";

/**
 * Storefront layout. Admin routes use a separate layout so they never ship the
 * public chrome (or vice-versa).
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StoreAnnouncement />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

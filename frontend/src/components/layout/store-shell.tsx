import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartProvider } from "@/components/cart/cart-provider";
import { getAuthenticatedUser } from "@/lib/auth/server";

/** Send administrators to the admin shell before any storefront chrome renders. */
export async function redirectAdminToAdminShell() {
  const user = await getAuthenticatedUser();
  if (user?.role === "admin") redirect("/admin");
  return user;
}

export async function StoreShell({ children }: { children: React.ReactNode }) {
  await redirectAdminToAdminShell();
  return (
    <CartProvider>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}

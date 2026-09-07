import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { StorefrontHome } from "@/components/home/storefront-home";
import { StoreShell } from "@/components/layout/store-shell";
import { EntryExperience } from "@/components/entry/entry-experience";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { ENTRY_MODE_STORAGE_KEY, parseEntryMode } from "@/lib/entry-mode";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  if (user?.role === "admin") redirect("/admin");

  const storefront = (
    <StoreShell>
      <StorefrontHome />
    </StoreShell>
  );

  if (user) return storefront;

  const preference = parseEntryMode((await cookies()).get(ENTRY_MODE_STORAGE_KEY)?.value);
  if (preference === "guest") return storefront;
  if (preference === "customer") redirect("/auth/sign-in");
  if (preference === "admin") redirect("/admin/login");

  return <EntryExperience />;
}

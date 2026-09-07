import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 request proxy. Refreshes the Supabase session with getClaims()
 * and forwards the pathname. Page, API, and database authorization still run
 * independently in layouts, route handlers, and FastAPI.
 */
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  const path = request.nextUrl.pathname;
  if (path.startsWith("/account") || path.startsWith("/admin") || path.startsWith("/api/admin") || path.startsWith("/auth/")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/|brand/).*)"],
};

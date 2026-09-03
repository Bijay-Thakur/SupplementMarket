import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 request proxy. Authorization still happens in Route Handlers,
 * server actions, and data-access functions. This only forwards the pathname
 * and, when Supabase auth is configured, session refresh is handled in
 * Route Handlers via `@supabase/ssr` cookie clients.
 */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|media/|brand/).*)"],
};

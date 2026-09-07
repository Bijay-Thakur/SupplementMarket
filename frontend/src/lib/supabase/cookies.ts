import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env/public";

export type PendingAuthCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export function supabaseSsrCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: publicEnv.siteUrl.startsWith("https://"),
  };
}

function sameSiteValue(value: unknown): "lax" | "strict" | "none" {
  return value === "strict" || value === "none" ? value : "lax";
}

export function applyAuthCookies(response: NextResponse, pending: PendingAuthCookie[]) {
  const http = publicEnv.siteUrl.startsWith("http://");
  for (const cookie of pending) {
    const raw = cookie.options ?? {};
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      path: typeof raw.path === "string" && raw.path ? raw.path : "/",
      sameSite: sameSiteValue(raw.sameSite),
      secure: !http,
      httpOnly: raw.httpOnly === true,
      ...(typeof raw.maxAge === "number" ? { maxAge: raw.maxAge } : {}),
      ...(raw.expires instanceof Date ? { expires: raw.expires } : {}),
    });
  }
  return response;
}

export function redirectWithAuthCookies(path: string, pending: PendingAuthCookie[]) {
  const dest = new URL(path, publicEnv.siteUrl);
  const response = NextResponse.redirect(dest, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return applyAuthCookies(response, pending);
}

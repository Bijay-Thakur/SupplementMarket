import "server-only";

import { serverEnv } from "@/lib/env/server";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { getVerifiedAccessToken } from "@/lib/auth/server";

/**
 * Forward a catalog-admin request to FastAPI with the verified user JWT.
 * Authorization is established by requireAdmin() plus this bearer token.
 * FastAPI re-validates the token and public.user_roles independently.
 */
export async function fastapiAdmin(path: string, init: RequestInit = {}) {
  const accessToken = await getVerifiedAccessToken();
  if (!accessToken) {
    throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    const upstreamPath = `/api/v1/admin/live${path}`;
    // Vercel maps api/backend.py to one exact function route. Forward the
    // internal FastAPI path as a validated query value so nested admin routes
    // do not fall into Vercel's directory/trailing-slash redirect loop.
    const upstreamUrl = serverEnv.fastapiOrigin.endsWith("/api/backend")
      ? `${serverEnv.fastapiOrigin}?__path=${encodeURIComponent(upstreamPath)}`
      : `${serverEnv.fastapiOrigin}${upstreamPath}`;
    res = await fetch(upstreamUrl, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    const localHelp = serverEnv.fastapiOrigin.includes("localhost")
      ? " Start local development from the project root with npm run dev so both the website and CSV service are running."
      : " Check the configured FASTAPI_ORIGIN and deployment health.";
    throw new ApiHttpError(
      503,
      `The catalog import service is unavailable.${localHelp}`,
      "service_unavailable",
    );
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: "upstream", detail: "Catalog service returned an unexpected response." };
  }
  if (!res.ok) {
    const body = data as { detail?: string; error?: string };
    throw new ApiHttpError(res.status, body.detail || "Catalog request failed.", body.error || "error");
  }
  return data;
}

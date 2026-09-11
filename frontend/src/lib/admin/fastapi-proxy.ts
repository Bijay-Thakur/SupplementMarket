import "server-only";

import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import { ApiHttpError } from "@/lib/demo-store/engine";
import { getVerifiedAccessToken, requireAdmin } from "@/lib/auth/server";

function signingSecret(): string {
  const secret = serverEnv.adminInternalSecret || serverEnv.supabaseServiceRoleKey;
  if (!secret) {
    throw new ApiHttpError(
      503,
      "The catalog service is not configured for secure internal requests.",
      "service_unavailable",
    );
  }
  return secret;
}

function splitPath(path: string): { pathname: string; search: string } {
  const separator = path.indexOf("?");
  if (separator === -1) return { pathname: path, search: "" };
  return { pathname: path.slice(0, separator), search: path.slice(separator + 1) };
}

/**
 * Forward a catalog-admin request to FastAPI after verifying the session and
 * role. A short-lived HMAC assertion authenticates this server-to-server hop;
 * the bearer token remains available for the backend's fail-closed fallback.
 */
export async function fastapiAdmin(path: string, init: RequestInit = {}) {
  const admin = await requireAdmin({ kind: "api" });
  const accessToken = await getVerifiedAccessToken();
  if (!accessToken) {
    throw new ApiHttpError(401, "Sign in is required.", "unauthorized");
  }
  const { pathname, search } = splitPath(path);
  if (!pathname.startsWith("/") || pathname.includes("..")) {
    throw new ApiHttpError(400, "Invalid catalog service path.", "validation");
  }
  const upstreamPath = `/api/v1/admin/live${pathname}`;
  const method = (init.method || "GET").toUpperCase();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", signingSecret())
    .update(`${timestamp}\n${method}\n${upstreamPath}\n${admin.id}`)
    .digest("hex");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-BNM-Admin-User", admin.id);
  headers.set("X-BNM-Admin-Timestamp", timestamp);
  headers.set("X-BNM-Admin-Signature", signature);
  let res: Response;
  try {
    // Vercel maps api/backend.py to one exact function route. Forward the
    // internal FastAPI path as a validated query value so nested admin routes
    // do not fall into Vercel's directory/trailing-slash redirect loop.
    let upstreamUrl: string;
    if (serverEnv.fastapiOrigin.endsWith("/api/backend")) {
      const params = new URLSearchParams(search);
      params.set("__path", upstreamPath);
      upstreamUrl = `${serverEnv.fastapiOrigin}?${params.toString()}`;
    } else {
      upstreamUrl = `${serverEnv.fastapiOrigin}${upstreamPath}${search ? `?${search}` : ""}`;
    }
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

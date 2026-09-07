import { NextRequest } from "next/server";

function firstHeaderValue(value: string | null): string {
  return (value || "").split(",", 1)[0]!.trim();
}

/** Public origin reconstructed from trusted proxy request metadata. */
export function requestOrigin(req: NextRequest): string {
  const forwardedHost = firstHeaderValue(req.headers.get("x-forwarded-host"));
  const host = forwardedHost || firstHeaderValue(req.headers.get("host"));
  const forwardedProto = firstHeaderValue(req.headers.get("x-forwarded-proto")).toLowerCase();
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : req.nextUrl.protocol.replace(":", "");

  // Reject path separators, credentials, whitespace, and malformed ports.
  if (host && /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(host)) {
    try {
      return new URL(`${protocol}://${host}`).origin;
    } catch {
      // Fall through to the URL Next.js already validated.
    }
  }
  return req.nextUrl.origin;
}

/** Reject cross-site POST/PATCH/DELETE from an unexpected Origin. */
export function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  if (origin !== requestOrigin(req)) {
    throw new Error("origin");
  }
}

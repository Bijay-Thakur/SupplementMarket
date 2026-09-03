import { createHmac, timingSafeEqual } from "node:crypto";
import type { AppRole, AuthUser } from "./types";
import { MOCK_SESSION_COOKIE } from "./types";

export type MockSessionPayload = {
  sub: string;
  role: AppRole;
  email: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
  provider: "mock";
};

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function signMockSession(payload: MockSessionPayload, secret: string): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyMockSession(token: string | undefined, secret: string): MockSessionPayload | null {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MockSessionPayload;
    if (payload.provider !== "mock") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    name: MOCK_SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function userFromMockPayload(payload: MockSessionPayload, extras?: Partial<AuthUser>): AuthUser {
  return {
    id: payload.sub,
    email: payload.email,
    emailVerified: true,
    username: payload.username,
    displayName: payload.displayName,
    firstName: payload.firstName,
    lastName: payload.lastName,
    avatarUrl: extras?.avatarUrl ?? null,
    phone: extras?.phone ?? null,
    profileCompleted: extras?.profileCompleted ?? true,
    role: payload.role,
    provider: "mock",
    isDemo: true,
  };
}

export const DEMO_CUSTOMER_ID = "00000000-0000-4000-a000-000000000001";
export const DEMO_ADMIN_ID = "00000000-0000-4000-a000-000000000002";

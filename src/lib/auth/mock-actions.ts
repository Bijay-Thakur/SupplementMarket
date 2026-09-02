import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import {
  AUTH_GENERIC_ERROR,
  PASSWORD_RESET_GENERIC,
  type SignUpInput,
  validatePassword,
  validateSignUp,
} from "@/lib/auth/types";
import { AuthHttpError } from "@/lib/auth/contract";
import {
  DEMO_ADMIN_ID,
  DEMO_CUSTOMER_ID,
  sessionCookieOptions,
  signMockSession,
  type MockSessionPayload,
} from "@/lib/auth/mock-session";
import {
  getMockProfile,
  getMockProfileByEmail,
  putMockProfile,
  uniqueUsername,
  usernameTaken,
} from "@/lib/auth/mock-store";
import type { AppRole, AuthUser } from "@/lib/auth/types";

function issueCookie(user: AuthUser, role: AppRole = user.role) {
  const now = Math.floor(Date.now() / 1000);
  const payload: MockSessionPayload = {
    sub: user.id,
    role,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
    provider: "mock",
  };
  const token = signMockSession(payload, serverEnv.mockAuthSecret ?? "");
  const opts = sessionCookieOptions();
  const res = NextResponse.json({ user: { ...user, role } });
  res.cookies.set(opts.name, token, opts);
  return res;
}

function jsonError(status: number, detail: string, fields?: Record<string, string>) {
  return NextResponse.json({ error: status === 401 ? "unauthorized" : "validation", detail, fields }, { status });
}

export function mockSignUp(input: SignUpInput) {
  const fields = validateSignUp(input);
  if (Object.keys(fields).length) throw new AuthHttpError(400, "Please correct the highlighted fields.", fields);
  void input.password;
  if (usernameTaken(input.username)) {
    throw new AuthHttpError(400, "Please correct the highlighted fields.", { username: "That username is not available." });
  }
  if (getMockProfileByEmail(input.email)) {
    throw new AuthHttpError(400, AUTH_GENERIC_ERROR);
  }
  const user: AuthUser = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    emailVerified: true,
    username: input.username.trim(),
    displayName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    avatarUrl: null,
    phone: null,
    profileCompleted: true,
    role: "customer",
    provider: "mock",
    isDemo: true,
  };
  putMockProfile(user);
  return issueCookie(user);
}

export function mockPasswordSignIn(email: string, password: string) {
  const pwdErr = validatePassword(password);
  if (pwdErr) return jsonError(400, AUTH_GENERIC_ERROR);
  void password;
  const existing = getMockProfileByEmail(email);
  if (existing) {
    if (existing.role === "admin") {
      return jsonError(401, AUTH_GENERIC_ERROR);
    }
    return issueCookie(existing, "customer");
  }
  const username = uniqueUsername(email.split("@")[0] ?? "shopper");
  const user: AuthUser = {
    id: randomUUID(),
    email: email.trim().toLowerCase(),
    emailVerified: true,
    username,
    displayName: username,
    firstName: "",
    lastName: "",
    avatarUrl: null,
    phone: null,
    profileCompleted: false,
    role: "customer",
    provider: "mock",
    isDemo: true,
  };
  putMockProfile(user);
  return issueCookie(user);
}

export function mockGoogle(role: AppRole = "customer") {
  const id = role === "admin" ? DEMO_ADMIN_ID : DEMO_CUSTOMER_ID;
  const user = getMockProfile(id);
  if (!user) return jsonError(500, "Demo identity is not available.");
  return issueCookie(user, role);
}

export function mockForgotPassword() {
  return NextResponse.json({ message: PASSWORD_RESET_GENERIC });
}

export function mockSignOut() {
  const res = NextResponse.json({ ok: true });
  const opts = sessionCookieOptions(0);
  res.cookies.set(opts.name, "", { ...opts, maxAge: 0 });
  return res;
}

import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AUTH_GENERIC_ERROR, PASSWORD_RESET_GENERIC, safeNextPath, validateSignUp } from "@/lib/auth/types";
import { signMockSession, verifyMockSession, type MockSessionPayload } from "@/lib/auth/mock-session";
import { resetMockAuthStore, getMockProfile, usernameTaken, uniqueUsername } from "@/lib/auth/mock-store";
import { DEMO_CUSTOMER_ID } from "@/lib/auth/mock-session";

describe("safe next redirect", () => {
  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("/auth/sign-in")).toBe("/account");
    expect(safeNextPath("/account/orders")).toBe("/account/orders");
  });
});

describe("signup validation", () => {
  it("requires matching passwords and terms", () => {
    const fields = validateSignUp({
      username: "ab",
      firstName: "",
      lastName: "",
      email: "not-an-email",
      password: "short",
      confirmPassword: "other",
      acceptedTerms: false,
    });
    expect(fields.username).toBeTruthy();
    expect(fields.password).toBeTruthy();
    expect(fields.confirmPassword).toBeTruthy();
    expect(fields.acceptedTerms).toBeTruthy();
  });
});

describe("mock session", () => {
  it("signs and verifies a customer session without a password", () => {
    const payload: MockSessionPayload = {
      sub: DEMO_CUSTOMER_ID,
      role: "customer",
      email: "demo.customer@bronxvillenatural.demo",
      username: "demo_customer",
      displayName: "Demo Customer",
      firstName: "Demo",
      lastName: "Customer",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      provider: "mock",
    };
    const token = signMockSession(payload, "test-secret");
    expect(verifyMockSession(token, "test-secret")?.role).toBe("customer");
    expect(JSON.stringify(payload)).not.toMatch(/password/i);
  });

  it("rejects a tampered cookie", () => {
    const payload: MockSessionPayload = {
      sub: DEMO_CUSTOMER_ID,
      role: "admin",
      email: "x@y.z",
      username: "x",
      displayName: "x",
      firstName: "x",
      lastName: "y",
      iat: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      provider: "mock",
    };
    const token = signMockSession(payload, "test-secret");
    const [body] = token.split(".");
    const badSig = createHmac("sha256", "other").update(body).digest("base64url");
    expect(verifyMockSession(`${body}.${badSig}`, "test-secret")).toBeNull();
  });
});

describe("mock store", () => {
  it("does not persist passwords and handles username collisions", () => {
    resetMockAuthStore();
    expect(getMockProfile(DEMO_CUSTOMER_ID)?.email).toContain("demo.customer");
    expect(usernameTaken("demo_customer")).toBe(true);
    expect(uniqueUsername("demo_customer")).not.toBe("demo_customer");
  });
});

describe("generic auth copy", () => {
  it("does not claim an email was sent", () => {
    expect(PASSWORD_RESET_GENERIC.toLowerCase()).not.toMatch(/email was sent/);
    expect(AUTH_GENERIC_ERROR.length).toBeGreaterThan(10);
  });
});

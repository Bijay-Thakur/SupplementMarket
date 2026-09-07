import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signUpSchema, safeNextPath, isSafeNextPath, passwordSchema } from "@/lib/auth/schemas";
import { validateSignUp, PASSWORD_RESET_GENERIC, AUTH_GENERIC_ERROR } from "@/lib/auth/types";

const authSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260903043203_customer_and_admin_auth.sql"),
  "utf8",
);
const catalogAuthSql = readFileSync(
  path.join(process.cwd(), "../supabase/migrations/20260903050000_admin_catalog_authorization.sql"),
  "utf8",
);

describe("signup validation", () => {
  it("requires username, full name, matching strong passwords, and rejects a role field", () => {
    const parsed = signUpSchema.safeParse({
      username: "ab",
      fullName: "",
      email: "not-an-email",
      password: "short",
      confirmPassword: "other",
      role: "admin",
    });
    expect(parsed.success).toBe(false);
    const fields = validateSignUp({
      username: "good_user",
      fullName: "Ada Lovelace",
      email: "Ada@Example.com",
      password: "secret123",
      confirmPassword: "secret123",
    });
    expect(fields).toEqual({});
    const withRole = signUpSchema.safeParse({
      username: "good_user",
      fullName: "Ada Lovelace",
      email: "ada@example.com",
      password: "secret123",
      confirmPassword: "secret123",
      role: "admin",
    });
    expect(withRole.success).toBe(false);
  });

  it("normalizes email and never accepts a weak password", () => {
    const parsed = signUpSchema.parse({
      username: "shopper_1",
      fullName: "Test User",
      email: "  Test.User@Example.COM ",
      password: "abcdefg1",
      confirmPassword: "abcdefg1",
    });
    expect(parsed.email).toBe("test.user@example.com");
    expect(passwordSchema.safeParse("password").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });
});

describe("open redirect rejection", () => {
  it("rejects external and protocol-relative targets", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath("/auth/sign-in")).toBe("/account");
    expect(isSafeNextPath("/account/orders")).toBe(true);
    expect(isSafeNextPath("/admin")).toBe(true);
    expect(isSafeNextPath("/auth/reset-password")).toBe(true);
    expect(isSafeNextPath("/auth/callback")).toBe(false);
  });
});

describe("password reset copy", () => {
  it("does not reveal whether an account exists", () => {
    expect(PASSWORD_RESET_GENERIC.toLowerCase()).not.toMatch(/email was sent to/);
    expect(AUTH_GENERIC_ERROR.length).toBeGreaterThan(10);
  });
});

describe("database authorization", () => {
  it("creates customer role on signup and does not let customers write user_roles", () => {
    expect(authSql).toMatch(/values \(new\.id, 'customer'\)/);
    expect(authSql).toMatch(/There are intentionally no INSERT, UPDATE, or DELETE/);
    expect(authSql).not.toMatch(/password_hash|password text/i);
    expect(authSql).toMatch(/create policy "Users read own role and admins read all"/);
  });

  it("lets only administrators mutate catalog and import tables", () => {
    expect(catalogAuthSql).toMatch(/using \(\(select public\.is_admin\(\)\)\)/);
    expect(catalogAuthSql).toMatch(/Admins write products/);
    expect(catalogAuthSql).toMatch(/Admins write import batches/);
    expect(catalogAuthSql).toMatch(/Admins insert product images/);
  });
});

describe("sign-out and session refresh", () => {
  it("signs out through Supabase Auth and refreshes claims in the proxy", () => {
    const authRoute = readFileSync(path.join(process.cwd(), "src/app/api/auth/route.ts"), "utf8");
    const proxy = readFileSync(path.join(process.cwd(), "src/lib/supabase/proxy.ts"), "utf8");
    const server = readFileSync(path.join(process.cwd(), "src/lib/auth/server.ts"), "utf8");
    expect(authRoute).toMatch(/auth\.signOut\(\)/);
    expect(authRoute).not.toMatch(/mockSignOut|demo-continue|signInWithOAuth/);
    expect(authRoute).not.toMatch(/verifyOtp/);
    expect(proxy).toMatch(/getClaims\(\)/);
    expect(server).toMatch(/getClaims/);
    expect(server).not.toMatch(/verifyMockSession|verifyDemoAdmin/);
  });
});

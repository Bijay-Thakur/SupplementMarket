import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { honeypotTripped } from "@/lib/security/honeypot";
import { signUpSchema } from "@/lib/auth/schemas";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

describe("secrets stay off the browser bundle", () => {
  it("does not import the server env module from client components", () => {
    const files = walk(path.join(process.cwd(), "src"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes('"use client"') && !text.includes("'use client'")) continue;
      expect(text, file).not.toMatch(/@\/lib\/env\/server/);
      expect(text, file).not.toMatch(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
      expect(text, file).not.toMatch(/process\.env\.SUPABASE_SECRET_KEY/);
      expect(text, file).not.toMatch(/process\.env\.STRIPE_SECRET_KEY/);
      expect(text, file).not.toMatch(/process\.env\.STRIPE_WEBHOOK_SECRET/);
      expect(text, file).not.toMatch(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    }
  });
});

describe("spam protection", () => {
  it("treats a filled honeypot as a bot and ignores an empty one", () => {
    expect(honeypotTripped({ company: "seo-bot" })).toBe(true);
    expect(honeypotTripped({ website: "https://spam.example" })).toBe(true);
    expect(honeypotTripped({ company: "  " })).toBe(false);
    expect(honeypotTripped({})).toBe(false);
  });

  it("requires acceptance of the terms before an account can be created", () => {
    const result = signUpSchema.safeParse({
      username: "shopper_1",
      fullName: "Test User",
      email: "test@example.com",
      password: "SecurePass123",
      confirmPassword: "SecurePass123",
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });
});

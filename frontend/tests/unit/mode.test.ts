import { describe, expect, it } from "vitest";
import { validateRuntimeMode, type RuntimeModeInput } from "@/lib/mode/validate";

const demo: RuntimeModeInput = {
  authProvider: "mock",
  dataProvider: "snapshot",
  paymentProvider: "disabled",
  customerAuthEnabled: false,
  mockAuthEnabled: true,
  stripeEnabledPublic: false,
  publicServiceRoleExposed: false,
  nodeEnv: "development",
};

describe("runtime mode validation", () => {
  it("accepts the hosted demo combination", () => {
    expect(validateRuntimeMode(demo)).toEqual([]);
  });

  it("rejects Stripe without secrets", () => {
    const errors = validateRuntimeMode({
      ...demo,
      authProvider: "supabase",
      dataProvider: "supabase",
      paymentProvider: "stripe_test",
      customerAuthEnabled: true,
      mockAuthEnabled: false,
      stripeEnabledPublic: true,
      supabaseUrl: "https://example.supabase.co",
      supabaseAnonKey: "anon",
      supabaseServiceRoleKey: "service",
    });
    expect(errors.some((e) => e.includes("Stripe requires"))).toBe(true);
  });

  it("rejects supabase data without credentials", () => {
    expect(
      validateRuntimeMode({ ...demo, dataProvider: "supabase" }).join(" "),
    ).toMatch(/DATA_PROVIDER=supabase/);
  });

  it("rejects mock auth with live payments", () => {
    expect(
      validateRuntimeMode({ ...demo, paymentProvider: "stripe_live" }).join(" "),
    ).toMatch(/Mock authentication/);
  });

  it("rejects live payments with snapshot data", () => {
    expect(
      validateRuntimeMode({
        ...demo,
        authProvider: "supabase",
        customerAuthEnabled: true,
        mockAuthEnabled: false,
        paymentProvider: "stripe_live",
        supabaseUrl: "https://example.supabase.co",
        supabaseAnonKey: "anon",
        supabaseServiceRoleKey: "service",
        stripeSecretKey: "sk_live_x",
        stripeWebhookSecret: "whsec_x",
        stripePublishableKey: "pk_live_x",
        stripeEnabledPublic: true,
      }).join(" "),
    ).toMatch(/snapshot/);
  });

  it("rejects a public service-role key", () => {
    expect(validateRuntimeMode({ ...demo, publicServiceRoleExposed: true }).join(" ")).toMatch(
      /NEXT_PUBLIC_/,
    );
  });
});

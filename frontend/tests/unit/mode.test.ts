import { describe, expect, it } from "vitest";
import { validateRuntimeMode, type RuntimeModeInput } from "@/lib/mode/validate";

const supabaseAuth: RuntimeModeInput = {
  authProvider: "supabase",
  dataProvider: "supabase",
  paymentProvider: "disabled",
  customerAuthEnabled: true,
  mockAuthEnabled: false,
  stripeEnabledPublic: false,
  supabaseUrl: "https://example.supabase.co",
  supabaseAnonKey: "anon",
  supabaseServiceRoleKey: "service",
  publicServiceRoleExposed: false,
  nodeEnv: "development",
};

describe("runtime mode validation", () => {
  it("accepts real Supabase authentication", () => {
    expect(validateRuntimeMode(supabaseAuth)).toEqual([]);
  });

  it("rejects mock authentication", () => {
    expect(
      validateRuntimeMode({ ...supabaseAuth, authProvider: "mock", mockAuthEnabled: true, customerAuthEnabled: false }).join(" "),
    ).toMatch(/Mock authentication has been removed/);
  });

  it("rejects Stripe without secrets", () => {
    const errors = validateRuntimeMode({
      ...supabaseAuth,
      paymentProvider: "stripe_test",
      stripeEnabledPublic: true,
    });
    expect(errors.some((e) => e.includes("Stripe requires"))).toBe(true);
  });

  it("rejects supabase data without credentials", () => {
    expect(
      validateRuntimeMode({
        ...supabaseAuth,
        supabaseUrl: undefined,
        supabaseAnonKey: undefined,
        supabaseServiceRoleKey: undefined,
      }).join(" "),
    ).toMatch(/DATA_PROVIDER=supabase/);
  });

  it("rejects live payments with snapshot data", () => {
    expect(
      validateRuntimeMode({
        ...supabaseAuth,
        dataProvider: "snapshot",
        paymentProvider: "stripe_live",
        stripeSecretKey: "sk_live_x",
        stripeWebhookSecret: "whsec_x",
        stripePublishableKey: "pk_live_x",
        stripeEnabledPublic: true,
      }).join(" "),
    ).toMatch(/snapshot/);
  });

  it("rejects a public service-role key", () => {
    expect(validateRuntimeMode({ ...supabaseAuth, publicServiceRoleExposed: true }).join(" ")).toMatch(
      /NEXT_PUBLIC_/,
    );
  });
});

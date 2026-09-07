import { z } from "zod";

/**
 * Public environment (safe for the browser bundle).
 *
 * Only `NEXT_PUBLIC_*` variables belong here. They MUST be referenced
 * statically (never via a dynamic key) so Next.js can inline them at build
 * time. Never add a server secret to this file.
 *
 * Supabase / Stripe values are optional so the app boots with placeholder or
 * absent credentials during development; feature code should branch on the
 * derived `*Configured` flags instead of assuming a value exists.
 */
const booleanFromEnv = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .optional()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED: booleanFromEnv,
  NEXT_PUBLIC_MOCK_AUTH_ENABLED: booleanFromEnv,
  NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED: booleanFromEnv,
  NEXT_PUBLIC_STRIPE_ENABLED: booleanFromEnv,
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED:
    process.env.NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED,
  NEXT_PUBLIC_MOCK_AUTH_ENABLED:
    process.env.NEXT_PUBLIC_MOCK_AUTH_ENABLED ?? "false",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED:
    process.env.NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED ?? "false",
  NEXT_PUBLIC_STRIPE_ENABLED: process.env.NEXT_PUBLIC_STRIPE_ENABLED,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  // Surface a readable message during build/startup without leaking values.
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid public environment configuration: ${issues}`);
}

const data = parsed.data;

function pickSupabaseBrowserKey(env: {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
}): string | undefined {
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  if (anon.startsWith("eyJ")) return anon;
  return publishable || anon || undefined;
}

export const publicEnv = {
  siteUrl: data.NEXT_PUBLIC_SITE_URL,
  customerAuthEnabled: data.NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED,
  mockAuthEnabled: data.NEXT_PUBLIC_MOCK_AUTH_ENABLED,
  demoRoleSelectorEnabled: data.NEXT_PUBLIC_DEMO_ROLE_SELECTOR_ENABLED,
  stripeEnabled: data.NEXT_PUBLIC_STRIPE_ENABLED,
  /**
   * FastAPI origin. Empty string means same-origin via Next.js rewrites
   * (`/api/v1`, `/media`) which is the local-demo default.
   */
  apiUrl: (data.NEXT_PUBLIC_API_URL || "").replace(/\/$/, ""),
  supabaseUrl: data.NEXT_PUBLIC_SUPABASE_URL || undefined,
  supabasePublishableKey: pickSupabaseBrowserKey(data),
  supabaseAnonKey: pickSupabaseBrowserKey(data),
  stripePublishableKey: data.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || undefined,
} as const;

/** True when both public Supabase values are present (not placeholders). */
export const supabasePublicConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabasePublishableKey,
);

/** True when the publishable Stripe key is present. */
export const stripePublicConfigured = Boolean(publicEnv.stripePublishableKey);

import "server-only";
import { z } from "zod";
import { publicEnv, supabasePublicConfigured } from "./public";

/**
 * Server-only environment. Importing `server-only` guarantees a build error if
 * this module is ever pulled into a client bundle, so secrets cannot leak.
 *
 * All secrets are optional to allow local development with placeholders. Code
 * paths that require a real value should assert the corresponding
 * `*Configured` flag and fail closed (never silently proceed insecurely).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STORE_TIMEZONE: z.string().min(1).default("America/New_York"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = serverSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STORE_TIMEZONE: process.env.STORE_TIMEZONE,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  throw new Error(`Invalid server environment configuration: ${issues}`);
}

const data = parsed.data;

// Guard against the classic mistake of exposing the service-role key publicly.
if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_.",
  );
}

export const serverEnv = {
  ...publicEnv,
  supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY || undefined,
  stripeSecretKey: data.STRIPE_SECRET_KEY || undefined,
  stripeWebhookSecret: data.STRIPE_WEBHOOK_SECRET || undefined,
  storeTimezone: data.STORE_TIMEZONE,
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === "production",
} as const;

/** True when the server can perform privileged Supabase operations. */
export const supabaseServiceConfigured = Boolean(
  supabasePublicConfigured && serverEnv.supabaseServiceRoleKey,
);

/** True when Stripe server-side calls (Checkout, webhooks) are possible. */
export const stripeServerConfigured = Boolean(
  serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret,
);

import "server-only";
import { z } from "zod";
import { publicEnv, supabasePublicConfigured } from "./public";
import { assertRuntimeMode, type AuthProvider, type DataProvider, type PaymentProvider } from "@/lib/mode/validate";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STORE_TIMEZONE: z.string().min(1).default("America/New_York"),
  AUTH_PROVIDER: z.enum(["mock", "supabase"]).default("supabase"),
  DATA_PROVIDER: z.enum(["snapshot", "supabase"]).default("snapshot"),
  PAYMENT_PROVIDER: z.enum(["disabled", "stripe_test", "stripe_live"]).default("disabled"),
  MOCK_AUTH_SECRET: z.string().optional(),
  APP_ENV: z.string().optional(),
  ADMIN_INTERNAL_SECRET: z.string().optional(),
  FASTAPI_ORIGIN: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = serverSchema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STORE_TIMEZONE: process.env.STORE_TIMEZONE,
  AUTH_PROVIDER: process.env.AUTH_PROVIDER ?? "supabase",
  DATA_PROVIDER: process.env.DATA_PROVIDER ?? "snapshot",
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER ?? "disabled",
  MOCK_AUTH_SECRET: process.env.MOCK_AUTH_SECRET,
  APP_ENV: process.env.APP_ENV,
  ADMIN_INTERNAL_SECRET: process.env.ADMIN_INTERNAL_SECRET,
  FASTAPI_ORIGIN: process.env.FASTAPI_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid server environment configuration: ${issues}`);
}

const data = parsed.data;

if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY) {
  throw new Error("Supabase secret keys must never be prefixed with NEXT_PUBLIC_.");
}

assertRuntimeMode({
  authProvider: data.AUTH_PROVIDER as AuthProvider,
  dataProvider: data.DATA_PROVIDER as DataProvider,
  paymentProvider: data.PAYMENT_PROVIDER as PaymentProvider,
  customerAuthEnabled: publicEnv.customerAuthEnabled,
  mockAuthEnabled: publicEnv.mockAuthEnabled,
  stripeEnabledPublic: publicEnv.stripeEnabled,
  supabaseUrl: publicEnv.supabaseUrl,
  supabaseAnonKey: publicEnv.supabaseAnonKey,
  supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY,
  stripeSecretKey: data.STRIPE_SECRET_KEY,
  stripeWebhookSecret: data.STRIPE_WEBHOOK_SECRET,
  stripePublishableKey: publicEnv.stripePublishableKey,
  publicServiceRoleExposed: Boolean(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY),
  nodeEnv: data.NODE_ENV,
});

export const serverEnv = {
  ...publicEnv,
  supabaseServiceRoleKey: data.SUPABASE_SERVICE_ROLE_KEY || undefined,
  stripeSecretKey: data.STRIPE_SECRET_KEY || undefined,
  stripeWebhookSecret: data.STRIPE_WEBHOOK_SECRET || undefined,
  storeTimezone: data.STORE_TIMEZONE,
  authProvider: data.AUTH_PROVIDER as AuthProvider,
  dataProvider: data.DATA_PROVIDER as DataProvider,
  paymentProvider: data.PAYMENT_PROVIDER as PaymentProvider,
  mockAuthSecret: "",
  nodeEnv: data.NODE_ENV,
  isProduction: data.NODE_ENV === "production",
  appEnv: (data.APP_ENV || "development").toLowerCase(),
  adminInternalSecret: data.ADMIN_INTERNAL_SECRET || "",
  fastapiOrigin: (data.FASTAPI_ORIGIN || "http://localhost:8000").replace(/\/$/, ""),
} as const;

export const supabaseServiceConfigured = Boolean(
  supabasePublicConfigured && serverEnv.supabaseServiceRoleKey,
);

export const stripeServerConfigured = Boolean(
  serverEnv.stripeSecretKey && serverEnv.stripeWebhookSecret,
);

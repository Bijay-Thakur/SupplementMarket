/**
 * Pure runtime-mode validation. Server and tests import this; it never reads
 * process.env itself so unit tests can pass explicit snapshots.
 */
export type AuthProvider = "mock" | "supabase";
export type DataProvider = "snapshot" | "supabase";
export type PaymentProvider = "disabled" | "stripe_test" | "stripe_live";

export type RuntimeModeInput = {
  authProvider: AuthProvider;
  dataProvider: DataProvider;
  paymentProvider: PaymentProvider;
  customerAuthEnabled: boolean;
  mockAuthEnabled: boolean;
  stripeEnabledPublic: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePublishableKey?: string;
  publicServiceRoleExposed: boolean;
  nodeEnv: string;
};

export function validateRuntimeMode(input: RuntimeModeInput): string[] {
  const errors: string[] = [];
  if (input.publicServiceRoleExposed) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY must never be prefixed with NEXT_PUBLIC_.");
  }

  const supabasePublicReady = Boolean(input.supabaseUrl && input.supabaseAnonKey);
  const supabaseReady = Boolean(
    supabasePublicReady && input.supabaseServiceRoleKey,
  );
  const stripeReady = Boolean(
    input.stripeSecretKey && input.stripeWebhookSecret && input.stripePublishableKey,
  );

  if (input.dataProvider === "supabase" && !supabaseReady) {
    errors.push("DATA_PROVIDER=supabase requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (input.authProvider === "mock") {
    errors.push("Mock authentication has been removed. Set AUTH_PROVIDER=supabase.");
  }
  if (input.authProvider === "supabase" && !supabasePublicReady) {
    errors.push("AUTH_PROVIDER=supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY).");
  }
  if (input.customerAuthEnabled && input.authProvider !== "supabase") {
    errors.push("NEXT_PUBLIC_CUSTOMER_AUTH_ENABLED=true requires AUTH_PROVIDER=supabase.");
  }
  if (input.authProvider === "mock" && input.customerAuthEnabled) {
    errors.push("Mock authentication cannot be combined with real customer auth.");
  }
  if (input.authProvider === "mock" && input.paymentProvider !== "disabled") {
    errors.push("Mock authentication cannot be combined with Stripe payments.");
  }
  if (input.paymentProvider !== "disabled" && input.dataProvider !== "supabase") {
    errors.push("Live or test Stripe cannot run against snapshot data.");
  }
  if (input.paymentProvider !== "disabled" && input.authProvider !== "supabase") {
    errors.push("Stripe requires AUTH_PROVIDER=supabase.");
  }
  if (input.paymentProvider !== "disabled" && !stripeReady) {
    errors.push("Stripe requires STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.");
  }
  if (input.stripeEnabledPublic && input.paymentProvider === "disabled") {
    errors.push("NEXT_PUBLIC_STRIPE_ENABLED=true is invalid while PAYMENT_PROVIDER=disabled.");
  }
  if (
    input.paymentProvider === "stripe_live" &&
    input.stripeSecretKey &&
    !input.stripeSecretKey.startsWith("sk_live_")
  ) {
    errors.push("PAYMENT_PROVIDER=stripe_live requires a live Stripe secret key.");
  }
  if (
    input.paymentProvider === "stripe_test" &&
    input.stripeSecretKey &&
    input.stripeSecretKey.startsWith("sk_live_")
  ) {
    errors.push("PAYMENT_PROVIDER=stripe_test cannot use a live Stripe secret key.");
  }
  if (input.mockAuthEnabled) {
    errors.push("NEXT_PUBLIC_MOCK_AUTH_ENABLED must be false. Mock authentication has been removed.");
  }
  if (input.nodeEnv === "production" && input.authProvider === "mock" && input.dataProvider === "supabase") {
    errors.push("Production must not combine mock authentication with a real Supabase customer database.");
  }
  return errors;
}

export function assertRuntimeMode(input: RuntimeModeInput): void {
  const errors = validateRuntimeMode(input);
  if (errors.length) {
    throw new Error(`Invalid runtime configuration:\n- ${errors.join("\n- ")}`);
  }
}

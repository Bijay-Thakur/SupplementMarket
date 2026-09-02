export const MOCK_SESSION_COOKIE = "bnm_mock_session";

export type AppRole = "customer" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  profileCompleted: boolean;
  role: AppRole;
  provider: "mock" | "supabase";
  isDemo: boolean;
};

export type SignUpInput = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export type PasswordSignInInput = {
  email: string;
  password: string;
};

export type CustomerAddress = {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  deliveryInstructions: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export const AUTH_GENERIC_ERROR = "Could not complete sign-in. Check your details and try again.";
export const PASSWORD_RESET_GENERIC =
  "If an account exists for that address, continue with the next step shown here. This demo does not send email.";

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validateSignUp(input: SignUpInput): Record<string, string> {
  const fields: Record<string, string> = {};
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(input.username.trim())) {
    fields.username = "Use 3–32 letters, numbers, or underscores.";
  }
  if (!input.firstName.trim()) fields.firstName = "First name is required.";
  if (!input.lastName.trim()) fields.lastName = "Last name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    fields.email = "Enter a valid email.";
  }
  const pwd = validatePassword(input.password);
  if (pwd) fields.password = pwd;
  if (input.password !== input.confirmPassword) {
    fields.confirmPassword = "Passwords do not match.";
  }
  if (!input.acceptedTerms) fields.acceptedTerms = "Agree to the privacy policy and terms to continue.";
  return fields;
}

export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (next.startsWith("/auth/")) return fallback;
  return next;
}

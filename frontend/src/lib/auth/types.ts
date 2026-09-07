import { passwordSchema, signUpSchema, safeNextPath as safeRedirect } from "./schemas";

export const MOCK_SESSION_COOKIE = "bnm_mock_session";

export type AppRole = "customer" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  profileCompleted: boolean;
  role: AppRole;
  provider: "supabase";
  isDemo: false;
  createdAt: string | null;
  missingProfile: boolean;
  missingRole: boolean;
};

export type SignUpInput = {
  username: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms?: boolean;
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
  "If an account exists for that address, you will receive password-reset instructions shortly.";
export const ADMIN_FORBIDDEN_MESSAGE = "This account does not have administrator access.";
export const UNCONFIRMED_EMAIL_MESSAGE = "Confirm your email before signing in. Check your inbox for a confirmation link.";
export const EXPIRED_LINK_MESSAGE = "This link has expired or was already used. Request a new one.";
export const DUPLICATE_USERNAME_MESSAGE = "That username is already taken.";
export const NETWORK_FAILURE_MESSAGE = "The network request failed. Try again.";
export const EMAIL_RATE_LIMIT_MESSAGE =
  "Too many confirmation emails were requested. Please wait and try again, or contact the store.";
export const EMAIL_DELIVERY_UNAVAILABLE_MESSAGE =
  "The confirmation email could not be sent. Check the store's email service configuration and try again.";
export const SIGNUP_GENERIC_ERROR =
  "Could not create the account. Check your details and try again.";
export const MISSING_PROFILE_MESSAGE = "Your profile is not ready yet. Sign out and sign in again, or contact the store.";
export const MISSING_ROLE_MESSAGE = "Your account role is missing. Contact the store if this continues.";

export const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  const parsed = passwordSchema.safeParse(password);
  return parsed.success ? null : parsed.error.issues[0]?.message || "Enter a stronger password.";
}

export function validateSignUp(input: SignUpInput): Record<string, string> {
  const fullName =
    input.fullName?.trim() ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const parsed = signUpSchema.safeParse({
    username: input.username,
    fullName,
    email: input.email,
    password: input.password,
    confirmPassword: input.confirmPassword,
    acceptedTerms: input.acceptedTerms,
  });
  if (parsed.success) return {};
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  return safeRedirect(next, fallback);
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

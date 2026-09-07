import type { AuthUser, CustomerAddress, PasswordSignInInput, SignUpInput } from "./types";

export type AuthProvider = {
  getCurrentUser(): Promise<AuthUser | null>;
  signUp(input: SignUpInput): Promise<AuthUser>;
  signInWithPassword(input: PasswordSignInInput): Promise<AuthUser>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<{ message: string }>;
  updatePassword(password: string): Promise<void>;
  refreshSession(): Promise<AuthUser | null>;
  updateProfile(patch: Partial<Pick<AuthUser, "displayName" | "fullName" | "phone" | "username" | "avatarUrl">>): Promise<AuthUser>;
  requireUser(): Promise<AuthUser>;
  requireAdmin(): Promise<AuthUser>;
};

export class AuthHttpError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export type AddressInput = Omit<CustomerAddress, "id" | "userId" | "createdAt" | "updatedAt">;

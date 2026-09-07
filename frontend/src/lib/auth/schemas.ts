import { z } from "zod";

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,32}$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: "Password must include at least one letter and one number.",
  });

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, "Use 3–32 letters, numbers, or underscores.");

export const signUpSchema = z
  .object({
    username: usernameSchema,
    fullName: z.string().trim().min(1, "Full name is required.").max(120, "Full name is too long."),
    email: z.string().trim().min(1, "Enter a valid email.").email("Enter a valid email."),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptedTerms: z.boolean().optional(),
    role: z.unknown().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
    if (value.role !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["role"],
        message: "Role cannot be chosen during signup.",
      });
    }
  })
  .transform((value) => ({
    username: value.username,
    fullName: value.fullName,
    email: normalizeEmail(value.email),
    password: value.password,
    confirmPassword: value.confirmPassword,
    acceptedTerms: value.acceptedTerms,
  }));

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter a valid email.").email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
  portal: z.enum(["customer", "admin"]).optional(),
  next: z.string().optional(),
}).transform((value) => ({
  ...value,
  email: normalizeEmail(value.email),
}));

export const emailOnlySchema = z.object({
  email: z.string().trim().min(1, "Enter a valid email.").email("Enter a valid email."),
}).transform((value) => ({ email: normalizeEmail(value.email) }));

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  fullName: z.string().trim().min(1, "Full name is required.").max(120, "Full name is too long."),
  phone: z
    .string()
    .trim()
    .max(32, "Phone number is too long.")
    .optional()
    .or(z.literal("")),
  avatarUrl: z
    .string()
    .trim()
    .max(2000, "Avatar URL is too long.")
    .refine((value) => !value || !/^(javascript|data):/i.test(value), "Enter a valid avatar URL.")
    .optional()
    .or(z.literal("")),
});

export type SignUpValues = z.output<typeof signUpSchema>;
export type SignInValues = z.output<typeof signInSchema>;
export type ProfileUpdateValues = z.output<typeof profileUpdateSchema>;

const ALLOWED_NEXT = [
  /^\/$/,
  /^\/account(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/admin(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/products(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/sales(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/brands(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/cart(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/checkout(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/order(?:\/[A-Za-z0-9/_-]*)?$/,
  /^\/auth\/reset-password$/,
  /^\/auth\/check-email$/,
];

export function isSafeNextPath(next: string): boolean {
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || next.includes("://")) {
    return false;
  }
  const path = next.split("?")[0]?.split("#")[0] ?? "";
  if (path.startsWith("/auth/") && path !== "/auth/reset-password" && path !== "/auth/check-email") {
    return false;
  }
  return ALLOWED_NEXT.some((pattern) => pattern.test(path));
}

export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next) return fallback;
  return isSafeNextPath(next) ? next : fallback;
}

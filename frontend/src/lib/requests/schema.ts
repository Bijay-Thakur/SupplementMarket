import { z } from "zod";

export const requestStatuses = ["new", "reviewing", "ordered", "unavailable", "completed"] as const;
export const supplementRequestSchema = z.object({
  request_key: z.uuid(),
  supplement_name: z.string().trim().min(2, "Enter the supplement name.").max(200),
  brand: z.string().trim().max(120).default(""),
  upc: z.string().trim().regex(/^(?:\d{8}|\d{12,14})?$/, "Enter an 8, 12, 13, or 14 digit UPC, or leave it blank.").default(""),
  size: z.string().trim().max(100).default(""),
  strength: z.string().trim().max(100).default(""),
  form: z.string().trim().max(100).default(""),
  customer_name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().email().max(254).transform((s) => s.toLowerCase()),
  phone: z.string().trim().max(32).default(""),
  notes: z.string().trim().max(1000).default(""),
  website: z.string().max(0).optional(), // Honeypot, never persisted.
}).strict();

export type SupplementRequest = Omit<z.output<typeof supplementRequestSchema>, "website" | "request_key"> & {
  id: string;
  created_at: string;
  status: typeof requestStatuses[number];
};

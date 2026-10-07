import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth/origin";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { supplementRequestSchema } from "@/lib/requests/schema";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(req: NextRequest) {
  try { assertSameOrigin(req); } catch { return json({ detail: "Invalid request origin." }, 403); }
  // Bound the body before parsing, including chunked requests.
  const reader = req.body?.getReader();
  if (!reader) return json({ detail: "Request details are required." }, 400);
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12_000) { await reader.cancel(); return json({ detail: "Request is too large." }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = supplementRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return json({ detail: parsed.error.issues[0]?.message || "Check the request details." }, 400);
    const client = getSupabaseAdminClient();
    if (!client || !serverEnv.supabaseServiceRoleKey) return json({ detail: "Requests are temporarily unavailable." }, 503);
    const user = await getAuthenticatedUser();
    // Vercel overwrites this header; do not trust client-supplied X-Forwarded-For.
    const ip = process.env.VERCEL ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown" : "local";
    const fingerprint = createHmac("sha256", serverEnv.supabaseServiceRoleKey).update(`supplement-request:${ip}`).digest("hex");
    const { website: _honeypot, ...payload } = parsed.data;
    void _honeypot;
    const { error } = await client.rpc("submit_supplement_request", {
      payload,
      requester: user?.id ?? null,
      client_fingerprint: fingerprint,
    });
    if (error) {
      const limited = error.message.includes("request_rate_limit");
      return json({ detail: limited ? "Too many requests. Please try again in an hour." : "Your request could not be saved. Please try again." }, limited ? 429 : 503);
    }
    // Do not expose an existing request's ID or contact information on retries.
    return json({ ok: true }, 201);
  } catch { return json({ detail: "Unable to submit. Check your details and try again." }, 400); }
}

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import { stripeEnabled } from "@/lib/payments/stripe";

type StoredEvent = { id: string; type: string; hash: string; processed: boolean };

function box() {
  const g = globalThis as typeof globalThis & { __bnmPaymentEvents?: Map<string, StoredEvent> };
  if (!g.__bnmPaymentEvents) g.__bnmPaymentEvents = new Map();
  return g.__bnmPaymentEvents;
}

function verifySignature(raw: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=")));
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const signed = `${ts}.${raw}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Stripe webhook. Never marks an order paid from the browser success URL.
 * Disabled mode returns 503 without calling Stripe.
 */
export async function POST(req: NextRequest) {
  if (!stripeEnabled()) {
    return NextResponse.json({ error: "payment_disabled", detail: "Stripe is disabled." }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!verifySignature(raw, sig, serverEnv.stripeWebhookSecret ?? "")) {
    return NextResponse.json({ error: "invalid_signature", detail: "Webhook signature was rejected." }, { status: 400 });
  }
  const event = JSON.parse(raw) as { id: string; type: string };
  const events = box();
  if (events.get(event.id)?.processed) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  events.set(event.id, { id: event.id, type: event.type, hash: createHmac("sha256", "payload").update(raw).digest("hex"), processed: true });
  return NextResponse.json({ ok: true, type: event.type });
}

export async function GET() {
  return NextResponse.json({
    enabled: stripeEnabled(),
    notice: "Orders are never marked paid because the browser reached a success URL.",
  });
}

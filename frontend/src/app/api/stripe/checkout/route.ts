import { NextRequest, NextResponse } from "next/server";
import { stripeEnabled, createStripeCheckoutSession } from "@/lib/payments/stripe";
import { requireUser } from "@/lib/auth/server";
import { publicEnv } from "@/lib/env/public";
import { ApiHttpError } from "@/lib/demo-store/engine";

export async function POST(req: NextRequest) {
  try {
    if (!stripeEnabled()) {
      return NextResponse.json(
        { error: "payment_disabled", detail: "Online card payment is unavailable." },
        { status: 503 },
      );
    }
    await requireUser(req);
    const body = (await req.json()) as {
      orderId: string;
      publicToken: string;
      amountCents: number;
      currency?: string;
      email: string;
      idempotencyKey: string;
    };
    const session = await createStripeCheckoutSession({
      orderId: body.orderId,
      publicToken: body.publicToken,
      amountCents: body.amountCents,
      currency: body.currency ?? "usd",
      idempotencyKey: body.idempotencyKey,
      customerEmail: body.email,
      successUrl: `${publicEnv.siteUrl}/order/confirmation/${body.publicToken}?checkout=success`,
      cancelUrl: `${publicEnv.siteUrl}/checkout?cancelled=1`,
    });
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    if (err instanceof ApiHttpError) {
      return NextResponse.json(err.body, { status: err.status });
    }
    return NextResponse.json({ error: "error", detail: "Could not start checkout." }, { status: 500 });
  }
}

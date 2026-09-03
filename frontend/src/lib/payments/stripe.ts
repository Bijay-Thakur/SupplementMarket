import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env/server";
import { ApiHttpError } from "@/lib/demo-store/engine";

export function stripeEnabled(): boolean {
  return serverEnv.paymentProvider === "stripe_test" || serverEnv.paymentProvider === "stripe_live";
}

export function getStripe(): Stripe {
  if (!stripeEnabled() || !serverEnv.stripeSecretKey) {
    throw new ApiHttpError(503, "Online card payment is not available.", "payment_disabled");
  }
  return new Stripe(serverEnv.stripeSecretKey);
}

export async function createStripeCheckoutSession(input: {
  orderId: string;
  publicToken: string;
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.customerEmail,
      client_reference_id: input.orderId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { order_id: input.orderId, public_token: input.publicToken },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: { name: `Bronxville Natural Market order ${input.orderId}` },
          },
        },
      ],
    },
    { idempotencyKey: input.idempotencyKey },
  );
}

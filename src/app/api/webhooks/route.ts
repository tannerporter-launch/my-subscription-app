import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// POST /api/webhooks — Stripe webhook listener. Verifies the signature, then
// syncs subscription state into Supabase via the service-role client.
export async function POST(req: Request) {
  const body = await req.text(); // raw body required for signature verification
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return new NextResponse("Missing signature or secret", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return new NextResponse(
      `Invalid signature: ${e instanceof Error ? e.message : "unknown"}`,
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  async function syncSubscription(sub: Stripe.Subscription, fallbackUserId?: string) {
    const userId = sub.metadata?.supabase_user_id ?? fallbackUserId;
    if (!userId) return;

    const item = sub.items.data[0];
    // current_period_end lives on the subscription (older API) or the item (newer).
    const periodEnd =
      (sub as unknown as { current_period_end?: number }).current_period_end ??
      (item as unknown as { current_period_end?: number })?.current_period_end;

    await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        price_id: item?.price?.id ?? null,
        current_period_end: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          await syncSubscription(sub, session.client_reference_id ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
    }
  } catch (e) {
    // Log and 500 so Stripe retries.
    console.error("Webhook handler error:", e);
    return new NextResponse("Handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

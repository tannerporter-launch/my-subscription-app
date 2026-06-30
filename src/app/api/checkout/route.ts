import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, PRO_PRICE_ID } from "@/lib/stripe";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

// POST /api/checkout — start a Stripe Checkout session for the Pro plan.
export async function POST(req: Request) {
  const base = baseUrl(req);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/register", base), { status: 303 });
    }

    if (!PRO_PRICE_ID || !process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured on the server." },
        { status: 500 },
      );
    }

    const admin = createAdminClient();

    // Reuse the user's Stripe customer if we've created one before.
    const { data: existing } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id as string | undefined;

    // Verify the stored customer still exists in the CURRENT Stripe mode. A
    // test-mode customer is invalid under a live key (and vice versa), and a
    // deleted customer must not be reused — otherwise checkout throws
    // "No such customer" and 500s.
    if (customerId) {
      try {
        const c = await stripe.customers.retrieve(customerId);
        if ((c as { deleted?: boolean }).deleted) customerId = undefined;
      } catch {
        customerId = undefined;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("subscriptions")
        .upsert(
          { user_id: user.id, stripe_customer_id: customerId, status: "inactive" },
          { onConflict: "user_id" },
        );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${base}/dashboard?checkout=success`,
      cancel_url: `${base}/pricing?checkout=cancelled`,
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
    });

    return NextResponse.redirect(session.url!, { status: 303 });
  } catch (err) {
    // Log the real error to the server logs (visible in Vercel) and return a
    // readable message instead of a blank HTTP 500 page.
    console.error("[/api/checkout] failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to start checkout.", detail: message },
      { status: 500 },
    );
  }
}

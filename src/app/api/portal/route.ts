import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}

// POST /api/portal — open the Stripe billing portal so the user can manage or
// cancel their subscription.
export async function POST(req: Request) {
  const base = baseUrl(req);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/register", base), { status: 303 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    // No customer yet — send them to pricing to subscribe first.
    return NextResponse.redirect(new URL("/pricing", base), { status: 303 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id as string,
    return_url: `${base}/dashboard`,
  });

  return NextResponse.redirect(portal.url, { status: 303 });
}

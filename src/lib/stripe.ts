import Stripe from "stripe";

// Server-only Stripe client. STRIPE_SECRET_KEY is never exposed to the browser.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  typescript: true,
});

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_PRO ?? "";

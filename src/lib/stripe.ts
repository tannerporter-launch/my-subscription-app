import Stripe from "stripe";

// Server-only Stripe client. STRIPE_SECRET_KEY is never exposed to the browser.
//
// Created LAZILY: importing this module must not instantiate Stripe, because at
// build time STRIPE_SECRET_KEY (a Sensitive env var) is absent and the Stripe
// constructor throws on an empty key. The key is only needed at request time,
// where it is present in the runtime environment.
let client: Stripe | null = null;

function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  client = new Stripe(key, { typescript: true });
  return client;
}

// A lazy proxy so existing call sites (`stripe.checkout.sessions.create`, etc.)
// keep working unchanged — the real client is built on first property access,
// which only happens inside request handlers.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_PRO ?? "";

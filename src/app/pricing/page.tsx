import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  "Everything in the free plan",
  "Unlimited access to Pro features",
  "Priority support",
  "Cancel anytime from the billing portal",
];

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Reading own row is permitted by RLS (select-own policy).
  let status: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    status = data?.status ?? null;
  }
  const isActive = status === "active" || status === "trialing";

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-indigo-50 via-white to-white px-4 py-20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
          One plan, everything included. Test mode — use card{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
            4242 4242 4242 4242
          </code>
          .
        </p>
      </div>

      <div className="mt-10 w-full max-w-sm rounded-2xl border border-indigo-200 bg-white p-8 shadow-xl shadow-indigo-100/60 dark:border-indigo-500/30 dark:bg-slate-900 dark:shadow-black/30">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pro</h2>
          {isActive ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              Current plan
            </span>
          ) : null}
        </div>
        <p className="mt-4">
          <span className="text-4xl font-bold text-slate-900 dark:text-white">$10</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
        </p>

        <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <span className="mt-0.5 text-indigo-600 dark:text-indigo-400">✓</span>
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {!user ? (
            <Link
              href="/register"
              className="block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Sign up to subscribe
            </Link>
          ) : isActive ? (
            <form action="/api/portal" method="post">
              <button
                type="submit"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-slate-800"
              >
                Manage billing
              </button>
            </form>
          ) : (
            <form action="/api/checkout" method="post">
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Subscribe to Pro
              </button>
            </form>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        <Link href="/dashboard" className="hover:text-slate-600 dark:hover:text-slate-300">
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}

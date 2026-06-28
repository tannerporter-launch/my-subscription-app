import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ checkout?: string }>;

// Private route. The proxy already redirects unauthenticated requests; we
// re-verify here so the page never renders without a confirmed session.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/register");

  const { checkout } = await searchParams;
  // RLS lets the user read their own subscription row.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  const status = sub?.status ?? "inactive";
  const isActive = status === "active" || status === "trialing";
  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-indigo-50 via-white to-white px-4 py-16 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-indigo-100/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                ● Authenticated session
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                Your dashboard
              </h1>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-slate-800"
              >
                Sign out
              </button>
            </form>
          </div>

          <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" value={user.email ?? "—"} />
            <Field label="User ID" value={user.id} mono />
            <Field label="Provider" value={user.app_metadata?.provider ?? "email"} />
            <Field label="Member since" value={joined} />
          </dl>

          {checkout === "success" ? (
            <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              Subscription confirmed — welcome to Pro! (Status updates within a
              moment as Stripe notifies us.)
            </p>
          ) : null}

          {/* Billing card */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Billing
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {isActive ? "Pro — active" : "Free plan"}
                  <span className="ml-2 align-middle text-xs font-normal text-slate-400 dark:text-slate-500">
                    {status}
                  </span>
                </p>
                {isActive && renews ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Renews {renews}
                  </p>
                ) : null}
              </div>
              {isActive ? (
                <form action="/api/portal" method="post">
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 hover:shadow-md dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-slate-800"
                  >
                    Manage billing
                  </button>
                </form>
              ) : (
                <Link
                  href="/pricing"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/25 active:translate-y-0 active:scale-[0.98]"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate text-sm text-slate-900 dark:text-white ${
          mono ? "font-mono text-xs" : ""
        }`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

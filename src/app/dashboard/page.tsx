import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Private route. The proxy already redirects unauthenticated requests; we
// re-verify here so the page never renders without a confirmed session.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/register");

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
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-slate-800"
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

          <p className="mt-8 rounded-lg bg-indigo-50/70 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            This route is gated by server-side cookie verification in
            <code className="mx-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
              src/proxy.ts
            </code>
            and re-checked on the server before render.
          </p>
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

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-indigo-50 via-white to-white px-4 py-20 text-center dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-indigo-400">
        Next.js · Supabase · Tailwind
      </span>

      <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
        Build your subscription business,{" "}
        <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
          faster
        </span>
        .
      </h1>

      <p className="mx-auto mt-5 max-w-md text-base text-slate-500 dark:text-slate-400">
        A clean full-stack starter with secure email-and-password accounts and a
        private dashboard gated by server-side session verification.
      </p>

      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {user ? (
          <Link
            href="/dashboard"
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
          >
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link
              href="/register"
              className="w-full rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 sm:w-auto"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/register"
              className="w-full rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-slate-800 sm:w-auto"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
        <Feature title="Secure auth" body="Email + password accounts powered by Supabase, with rotating session cookies." />
        <Feature title="Server-gated" body="Private routes verified on the server before any content renders." />
        <Feature title="Production-ready" body="Typed, linted, and built on the Next.js App Router." />
      </div>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/50">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Safe in Client Components — it only ever uses
// the public anon key and the user's own cookies.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

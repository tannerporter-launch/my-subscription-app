import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

// Returns the signed-in user ONLY if their verified email matches ADMIN_EMAIL.
// Used by both the secret page and the API route so the gate is enforced
// server-side on every request — never trust the client.
export async function getAdminUser(): Promise<User | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail) return null; // misconfigured → deny by default

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;
  if (user.email.toLowerCase().trim() !== adminEmail) return null;

  return user;
}

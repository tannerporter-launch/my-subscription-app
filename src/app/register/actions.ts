"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

// Create a new account with email + password.
export async function signup(formData: FormData) {
  const supabase = await createClient();
  const { email, password } = readCredentials(formData);

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  // With email confirmations enabled, no session exists until the user verifies.
  if (!data.session) {
    redirect(
      `/register?message=${encodeURIComponent(
        "Check your inbox to confirm your email, then sign in.",
      )}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// Sign an existing user in.
export async function login(formData: FormData) {
  const supabase = await createClient();
  const { email, password } = readCredentials(formData);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/register?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

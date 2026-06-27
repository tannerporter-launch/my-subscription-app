import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { AdminChat } from "./AdminChat";

// Keep the secret route out of search indexes.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Server-rendered gate: anyone who is not the admin gets a clean 404 — the page
// never renders and its existence is not revealed.
export default async function AdminChatPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  return <AdminChat adminEmail={admin.email ?? ""} />;
}

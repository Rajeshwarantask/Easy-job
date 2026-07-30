import { SettingsClient } from "./client";
import { auth } from "@/lib/auth";

export default async function SettingsPage() {
  let session = null;
  try { session = await auth(); } catch { /* no auth */ }
  return <SettingsClient user={session?.user ?? null} />;
}

import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

export const metadata = {
  title: "Settings | JobTrail",
  description: "Manage your JobTrail preferences",
};

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try { session = await auth(); } catch { /* no auth */ }
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session?.user ?? null} />
      <main>{children}</main>
    </div>
  );
}

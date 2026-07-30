import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

export const metadata = {
  title: "Insights | JobTrail",
  description: "Analytics and insights on your job search",
};

export default async function InsightsLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try { session = await auth(); } catch { /* no auth */ }
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session?.user ?? null} />
      <main>{children}</main>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

export const metadata = {
  title: "Calendar | JobTrail",
  description: "View deadlines and upcoming interview dates",
};

export default async function CalendarLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try { session = await auth(); } catch { /* no auth */ }
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session?.user ?? null} />
      <main>{children}</main>
    </div>
  );
}

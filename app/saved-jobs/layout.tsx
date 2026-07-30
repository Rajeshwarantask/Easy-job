import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

export default async function SavedJobsLayout({ children }: { children: React.ReactNode }) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth not configured
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session?.user ?? null} />
      <main>{children}</main>
    </div>
  );
}

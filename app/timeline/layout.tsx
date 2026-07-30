import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

interface TimelineLayoutProps {
  children: React.ReactNode;
}

export default async function TimelineLayout({ children }: TimelineLayoutProps) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth not configured, render without session
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session?.user ?? null} />
      <main>{children}</main>
    </div>
  );
}

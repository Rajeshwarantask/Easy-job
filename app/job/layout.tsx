import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

interface JobLayoutProps {
  children: React.ReactNode;
}

export default async function JobLayout({ children }: JobLayoutProps) {
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

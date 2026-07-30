import { auth } from "@/lib/auth";
import { DashboardHeader } from "@/components/dashboard/header";

export const metadata = {
  title: "Job Search | JobTrail",
  description: "Search jobs from LinkedIn, Indeed, Glassdoor, Naukri and more — with filters for role, level, type and date.",
};

export default async function JobSearchLayout({ children }: { children: React.ReactNode }) {
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

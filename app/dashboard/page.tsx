
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getJobApplications, getUser } from "@/lib/db";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export const metadata = {
  title: "Dashboard | JobTrail",
  description: "Track your job applications",
};

interface DashboardPageProps {
  searchParams: Promise<{ demo?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const isDemo = params.demo === "true";

  if (isDemo) {
    return <DashboardClient isDemo serverJobs={[]} />;
  }

  let session;
  try {
    session = await auth();
  } catch {
    redirect("/");
  }

  if (!session?.user?.id) redirect("/");

  const [jobs, user] = await Promise.all([
    getJobApplications(session.user.id),
    getUser(session.user.id),
  ]);

  return (
    <DashboardClient
      isDemo={false}
      serverJobs={jobs}
      lastSyncedAt={user?.lastSyncedAt ?? null}
    />
  );
}

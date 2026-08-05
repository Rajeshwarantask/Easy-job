import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJobApplications } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const jobs = await getJobApplications(session.user.id);
  return NextResponse.json(jobs);
}

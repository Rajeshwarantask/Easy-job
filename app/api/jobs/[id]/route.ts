import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJobApplication, markJobAsRead } from "@/lib/supabase-db";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { id } = await params;
  const job = await getJobApplication(id, session.user.id);
  
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  
  // Mark as read when fetched
  await markJobAsRead(id, session.user.id);
  
  return NextResponse.json(job);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { 
      error: "Read-only",
      message: "Jobs are sourced from Gmail and cannot be manually edited. To update a job, modify the Gmail thread."
    }, 
    { status: 405 }
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { 
      error: "Read-only",
      message: "Jobs are sourced from Gmail and cannot be deleted. Archive the Gmail thread instead."
    }, 
    { status: 405 }
  );
}

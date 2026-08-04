import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EmailThread, ThreadTimelineEvent } from "@/lib/thread-types";

/**
 * GET /api/applications/[id]/threads
 * Fetch all email threads for an application
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Fetch threads for application
    const { data: threads, error: threadsError } = await supabase
      .from("email_threads")
      .select("*")
      .eq("application_id", id)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (threadsError) throw threadsError;

    if (!threads || threads.length === 0) {
      return NextResponse.json({
        threads: [],
        total: 0,
      });
    }

    // For each thread, fetch associated emails and timeline events
    const threadsWithDetails = await Promise.all(
      threads.map(async (thread: any) => {
        const [{ data: emails }, { data: events }] = await Promise.all([
          supabase
            .from("email_events")
            .select("id, email_from, email_subject, email_date, event_type, email_body_preview")
            .eq("thread_id", thread.id)
            .order("email_date", { ascending: false }),
          supabase
            .from("thread_timeline_events")
            .select("*")
            .eq("thread_id", thread.id)
            .order("event_order", { ascending: true }),
        ]);

        return {
          ...thread,
          emails: emails || [],
          events: events || [],
        };
      })
    );

    return NextResponse.json({
      threads: threadsWithDetails,
      total: threadsWithDetails.length,
    });
  } catch (error) {
    console.error("[v0] Error fetching threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch threads" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/applications/[id]/threads
 * Create or update threads for an application
 * Called after sync to build threading structure
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const body = await request.json();
    const { threadData } = body;

    if (!threadData) {
      return NextResponse.json(
        { error: "Missing threadData" },
        { status: 400 }
      );
    }

    // Verify application belongs to user
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Upsert thread
    const { data: thread, error: threadError } = await supabase
      .from("email_threads")
      .upsert(
        {
          ...threadData,
          user_id: session.user.id,
          application_id: id,
        },
        {
          onConflict: "unique_thread_per_app",
        }
      )
      .select()
      .single();

    if (threadError) throw threadError;

    return NextResponse.json(thread);
  } catch (error) {
    console.error("[v0] Error creating thread:", error);
    return NextResponse.json(
      { error: "Failed to create thread" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/applications/[id]/threads
 * Update thread status or metadata
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();
    const body = await request.json();
    const { threadId, status, notes } = body;

    if (!threadId) {
      return NextResponse.json(
        { error: "Missing threadId" },
        { status: 400 }
      );
    }

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updates.thread_status = status;
    if (notes) updates.notes = notes;

    const { data: thread, error } = await supabase
      .from("email_threads")
      .update(updates)
      .eq("id", threadId)
      .eq("application_id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(thread);
  } catch (error) {
    console.error("[v0] Error updating thread:", error);
    return NextResponse.json(
      { error: "Failed to update thread" },
      { status: 500 }
    );
  }
}

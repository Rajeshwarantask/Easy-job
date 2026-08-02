import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/applications/[id]
 * Fetch a single application with its email events
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    // Fetch application
    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    // Fetch related email events
    const { data: events, error: eventsError } = await supabase
      .from("email_events")
      .select("*")
      .eq("application_id", params.id)
      .order("created_at", { ascending: false });

    if (eventsError) {
      console.error("[v0] Error fetching events:", eventsError);
    }

    return NextResponse.json({
      application: app,
      email_events: events || [],
    });
  } catch (error) {
    console.error("[v0] API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/applications/[id]
 * Update application (star, notes, status, etc.)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = await createClient();

    // Build update object
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if ("starred" in body) updates.starred = body.starred;
    if ("notes" in body) updates.notes = body.notes;
    if ("status" in body) updates.status = body.status;
    if ("user_confidence" in body) updates.user_confidence = body.user_confidence;
    if ("archived_at" in body)
      updates.archived_at = body.archived_at ? new Date().toISOString() : null;

    const { data, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .select()
      .single();

    if (error) {
      console.error("[v0] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update application" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[v0] API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/applications/[id]
 * Archive an application
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("applications")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", params.id)
      .eq("user_id", session.user.id);

    if (error) {
      console.error("[v0] Archive error:", error);
      return NextResponse.json(
        { error: "Failed to archive application" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[v0] API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

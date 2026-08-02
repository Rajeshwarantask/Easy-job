import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/applications
 * Fetch user's applications with optional filtering and pagination
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const starred = searchParams.get("starred") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") === "asc" ? "asc" : "desc";

    const supabase = await createClient();

    let query = supabase
      .from("applications")
      .select("*", { count: "exact" })
      .eq("user_id", session.user.id)
      .is("archived_at", null);

    if (status) {
      query = query.eq("status", status);
    }

    if (starred) {
      query = query.eq("starred", true);
    }

    const { data, error, count } = await query
      .order(sort, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[v0] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applications: data || [],
      total: count || 0,
      limit,
      offset,
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
 * POST /api/applications
 * Create or update applications from parsed email data
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { applications } = body;

    if (!Array.isArray(applications)) {
      return NextResponse.json(
        { error: "Expected array of applications" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Upsert applications
    const results = [];

    for (const app of applications) {
      const normalizedCompany = app.company?.toLowerCase().trim() || "";
      const normalizedRole = app.role?.toLowerCase().trim() || "";

      const { data, error } = await supabase
        .from("applications")
        .upsert(
          {
            user_id: session.user.id,
            company: app.company,
            company_normalized: normalizedCompany,
            role: app.role,
            role_normalized: normalizedRole,
            location: app.location,
            work_mode: app.workMode,
            application_id: app.applicationId,
            requisition_id: app.requisitionId,
            candidate_id: app.candidateId,
            salary_min: app.salaryMin,
            salary_max: app.salaryMax,
            salary_currency: app.salaryCurrency || "USD",
            status: app.eventType || "applied",
            last_event_type: app.eventType,
            last_event_date: app.lastEventDate,
            next_interview_date: app.nextInterviewDate,
            next_interview_time: app.nextInterviewTime,
            next_interview_link: app.nextInterviewLink,
            next_interview_link_platform: app.nextInterviewLinkPlatform,
            interviewer_name: app.interviewerName,
            interviewer_email: app.interviewerEmail,
            offer_deadline: app.offerDeadline,
            job_url: app.jobUrl,
            career_portal_url: app.careerPortalUrl,
            parser_confidence: app.parserConfidence,
            parsing_platform: app.parsingPlatform,
            validation_score: app.validationScore,
            synced_at: new Date().toISOString(),
            last_email_thread_id: app.gmailThreadId,
          },
          { onConflict: "unique_user_application" }
        )
        .select();

      if (error) {
        console.error("[v0] Upsert error:", error);
        results.push({ error: error.message });
      } else {
        results.push({ id: data?.[0]?.id, success: true });
      }
    }

    return NextResponse.json({
      results,
      created: results.filter((r) => r.success).length,
    });
  } catch (error) {
    console.error("[v0] API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

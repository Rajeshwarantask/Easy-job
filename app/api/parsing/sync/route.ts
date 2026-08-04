/**
 * Email Sync API Route
 * 
 * POST /api/parsing/sync
 * 
 * Processes multiple Gmail emails through the parsing pipeline.
 * Returns array of ParsedApplication objects.
 * Caller is responsible for persistence (database, cache, etc).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { syncGmailEmails, summarizeSyncResult } from "@/lib/parsing/sync-orchestrator";
import type { GmailMessagePart } from "@/lib/parsing/mime-decoder";
import type { ParseResult } from "@/lib/parsing/types";

/**
 * POST /api/parsing/sync
 * 
 * Request body:
 * {
 *   userId: string;
 *   gmailMessages: Array<{
 *     id: string;
 *     threadId: string;
 *     payload: GmailMessagePart;
 *     snippet?: string;
 *   }>;
 *   skipFiltering?: boolean;
 * }
 * 
 * Response:
 * {
 *   processed: number;
 *   results: ParseResult[];
 *   errors: Array<{ gmailMessageId?, error, timestamp }>;
 *   syncDurationMs: number;
 *   syncedAt: Date;
 *   summary: { processed, successful, failed, applicationsCreated, applicationsUpdated };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { gmailMessages, skipFiltering } = body;
    const userId = session.user.id;

    // Validate input
    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(gmailMessages) || gmailMessages.length === 0) {
      return NextResponse.json(
        { error: "gmailMessages must be a non-empty array" },
        { status: 400 }
      );
    }

    // Validate each message
    for (const msg of gmailMessages) {
      if (!msg.id || !msg.threadId) {
        return NextResponse.json(
          { error: "Each message must have id and threadId" },
          { status: 400 }
        );
      }
    }

    // Process all emails through the pipeline
    const result = await syncGmailEmails(
      gmailMessages.map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        payload: msg.payload as GmailMessagePart | undefined,
        snippet: msg.snippet,
      })),
      {
        userId,
        gmailThreadId: gmailMessages[0]?.threadId,
        existingApplications: [], // In real app, would fetch from database
      },
      {
        skipFiltering: skipFiltering ?? false,
      }
    );

    // Add summary for easier client-side processing
    const summary = summarizeSyncResult(result);

    // Persist successful applications to Supabase
    try {
      const supabase = await createClient();

      const successfulResults = result.results.filter(
        (r: ParseResult) => r.success && r.application
      );

      if (successfulResults.length > 0) {
        const applicationsToSave = successfulResults.map((r: ParseResult) => {
          const app = r.application!;
          const firstEvent = app.timelineEvents?.[0];
          const eventDetails = firstEvent?.details || {};
          
          return {
            user_id: userId,
            company: app.company || "",
            company_normalized: (app.companyNormalized || app.company || "")
              .toLowerCase()
              .trim(),
            role: app.role || "",
            role_normalized: (app.role || "").toLowerCase().trim(),
            location: app.location || null,
            work_mode: app.workMode || null,
            application_id: app.applicationId || null,
            requisition_id: app.requisitionId || null,
            candidate_id: app.candidateId || null,
            salary_min: null,
            salary_max: null,
            salary_currency: eventDetails.currency || "USD",
            status: app.eventType || "applied",
            last_event_type: app.eventType,
            last_event_date: firstEvent?.date ? new Date(firstEvent.date).toISOString() : new Date().toISOString(),
            next_interview_date: eventDetails.interviewDate ? new Date(eventDetails.interviewDate).toISOString() : null,
            next_interview_time: firstEvent?.time || null,
            next_interview_link: eventDetails.interviewLink || null,
            next_interview_link_platform: null,
            interviewer_name: eventDetails.interviewer || null,
            interviewer_email: eventDetails.interviewerEmail || null,
            job_url: app.jobUrl || null,
            career_portal_url: app.careerPortalUrl || null,
            parser_confidence: Math.round(app.parserConfidence * 100),
            parsing_platform: app.parsedBy,
            validation_score: Math.round(app.validation.overallConfidence * 100),
            synced_at: new Date().toISOString(),
            last_email_thread_id: app.originalEmail.gmailThreadId,
          };
        });

        const { error: upsertError } = await supabase
          .from("applications")
          .upsert(applicationsToSave, {
            onConflict: "unique_user_application",
          });

        if (upsertError) {
          console.error("[v0] Error persisting applications:", upsertError);
        } else {
          console.log(
            `[v0] Persisted ${applicationsToSave.length} applications`
          );
        }
      }

      // Record sync history
      await supabase.from("sync_history").insert({
        user_id: userId,
        sync_start: new Date(Date.now() - result.syncDurationMs)
          .toISOString(),
        sync_end: new Date().toISOString(),
        emails_processed: result.processed,
        applications_created: successfulResults.length,
        applications_updated: 0,
        emails_skipped: result.results.filter(
          (r: ParseResult) => !r.success
        ).length,
        errors_count: result.errors?.length || 0,
        status: "completed",
      });
    } catch (persistError) {
      console.error("[v0] Error in persistence layer:", persistError);
      // Don't fail the response if persistence fails
    }

    return NextResponse.json(
      {
        ...result,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        processed: 0,
        results: [],
        errors: [
          {
            error: `API error: ${errorMessage}`,
            timestamp: new Date(),
          },
        ],
        syncDurationMs: 0,
        syncedAt: new Date(),
      },
      { status: 500 }
    );
  }
}

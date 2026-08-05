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

    // Extract parsed applications for client cache
    const successfulResults = result.results.filter(
      (r: ParseResult) => r.success && r.application
    );
    const applications = successfulResults.map((r: ParseResult) => r.application!);

    return NextResponse.json(
      {
        processed: result.processed,
        results: result.results,
        errors: result.errors,
        syncDurationMs: result.syncDurationMs,
        syncedAt: new Date().toISOString(),
        summary,
        applications, // Extract applications for sessionStorage
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

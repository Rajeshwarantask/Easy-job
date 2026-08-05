/**
 * Email Sync API Route
 * 
 * POST /api/parsing/sync
 * 
 * Fetches emails from Gmail API and processes them through the parsing pipeline.
 * Returns array of ParsedApplication objects for browser sessionStorage.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailEmails, summarizeSyncResult } from "@/lib/parsing/sync-orchestrator";
import type { ParseResult } from "@/lib/parsing/types";

/**
 * POST /api/parsing/sync
 * 
 * Fetches Gmail emails and parses them.
 * Requires authenticated user with Gmail access token.
 * 
 * Response:
 * {
 *   processed: number;
 *   applications: ParsedApplication[];
 *   errors: Array<{ error, timestamp }>;
 *   syncDurationMs: number;
 *   syncedAt: string;
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      console.log("[v0] Auth failed: no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const accessToken = session.accessToken;

    if (!accessToken) {
      console.log("[v0] Auth failed: no Gmail access token");
      return NextResponse.json(
        { error: "No Gmail access token. Please re-authenticate." },
        { status: 401 }
      );
    }

    // Fetch emails from Gmail API
    console.log("[v0] Fetching emails from Gmail for user:", userId);
    let gmailMessages: any[] = [];
    
    try {
      const gmailResponse = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=from:(indeed OR greenhouse OR linkedin OR workday OR lever OR oracle OR recruiter)",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!gmailResponse.ok) {
        if (gmailResponse.status === 401) {
          console.log("[v0] Gmail API: token expired");
          return NextResponse.json(
            { error: "Gmail access expired. Please re-authenticate." },
            { status: 401 }
          );
        }
        throw new Error(`Gmail API error: ${gmailResponse.status}`);
      }

      const gmailData = await gmailResponse.json();
      const messageIds = gmailData.messages?.map((m: any) => m.id) || [];

      console.log(`[v0] Found ${messageIds.length} recruitment emails`);

      // Fetch full message data for each email
      for (const messageId of messageIds.slice(0, 20)) {
        // Limit to 20 for initial sync
        try {
          const msgResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (msgResponse.ok) {
            const message = await msgResponse.json();
            gmailMessages.push({
              id: message.id,
              threadId: message.threadId,
              payload: message.payload,
              snippet: message.snippet,
            });
          }
        } catch (err) {
          console.error(`[v0] Failed to fetch message ${messageId}:`, err);
        }
      }
    } catch (gmailError) {
      console.error("[v0] Gmail API fetch failed:", gmailError);
      const errorMsg =
        gmailError instanceof Error ? gmailError.message : String(gmailError);
      return NextResponse.json(
        {
          processed: 0,
          applications: [],
          errors: [
            {
              error: `Failed to fetch from Gmail: ${errorMsg}`,
              timestamp: new Date().toISOString(),
            },
          ],
          syncDurationMs: Date.now() - startTime,
          syncedAt: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // If no messages found, return empty result
    if (gmailMessages.length === 0) {
      console.log("[v0] No recruitment emails found");
      return NextResponse.json(
        {
          processed: 0,
          applications: [],
          errors: [],
          syncDurationMs: Date.now() - startTime,
          syncedAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    // Process all emails through the pipeline
    console.log(`[v0] Processing ${gmailMessages.length} emails through parser`);
    const result = await syncGmailEmails(gmailMessages, {
      userId,
      gmailThreadId: gmailMessages[0]?.threadId,
      existingApplications: [],
    });

    // Extract parsed applications for client cache
    const successfulResults = result.results.filter(
      (r: ParseResult) => r.success && r.application
    );
    const applications = successfulResults.map((r: ParseResult) => r.application!);

    console.log(
      `[v0] Parser complete: ${applications.length} applications extracted`
    );

    return NextResponse.json(
      {
        processed: result.processed,
        applications,
        errors: result.errors,
        syncDurationMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[v0] Sync route error:", errorMessage, error);

    return NextResponse.json(
      {
        processed: 0,
        applications: [],
        errors: [
          {
            error: `Sync failed: ${errorMessage}`,
            timestamp: new Date().toISOString(),
          },
        ],
        syncDurationMs: Date.now() - startTime,
        syncedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

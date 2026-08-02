/**
 * Email Parsing API Route
 * 
 * POST /api/parsing/parse
 * 
 * Accepts raw email data and returns ParsedApplication.
 * Decoupled from persistence — caller decides what to do with the result.
 */

import { NextRequest, NextResponse } from "next/server";
import { processSingleEmail } from "@/lib/parsing/sync-orchestrator";
import type { GmailMessagePart } from "@/lib/parsing/mime-decoder";

/**
 * POST /api/parsing/parse
 * 
 * Request body:
 * {
 *   gmailMessage: {
 *     id: string;
 *     threadId: string;
 *     payload: GmailMessagePart;
 *     snippet?: string;
 *   };
 *   userId: string;
 *   skipFiltering?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { gmailMessage, userId, skipFiltering } = body;

    // Validate input
    if (!gmailMessage || !gmailMessage.id || !gmailMessage.threadId) {
      return NextResponse.json(
        { error: "Missing required fields: gmailMessage.id, gmailMessage.threadId" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    // Process email through the pipeline
    const result = await processSingleEmail(
      {
        id: gmailMessage.id,
        threadId: gmailMessage.threadId,
        payload: gmailMessage.payload as GmailMessagePart | undefined,
        snippet: gmailMessage.snippet,
      },
      {
        userId,
        gmailThreadId: gmailMessage.threadId,
        existingApplications: [], // In real app, would fetch from database
      },
      {
        skipFiltering: skipFiltering ?? false,
      }
    );

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: `API error: ${errorMessage}`,
        errorType: "parse",
      },
      { status: 500 }
    );
  }
}

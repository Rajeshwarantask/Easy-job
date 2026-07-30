import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailEmails } from "@/lib/gmail";

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  if (!session.accessToken) {
    return NextResponse.json({ error: "No access token available" }, { status: 401 });
  }
  
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Session expired. Please sign in again." },
      { status: 401 }
    );
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const includeDebug = body.debug === true;
    
    // Parse optional date range filter
    let dateRange: any = undefined;
    if (body.dateRange && body.dateRange !== "all") {
      const ranges: Record<string, { type: "days"; value: number }> = {
        "7days": { type: "days", value: 7 },
        "30days": { type: "days", value: 30 },
        "90days": { type: "days", value: 90 },
      };
      dateRange = ranges[body.dateRange];
    }

    const result = await syncGmailEmails(session.user.id, session.accessToken, dateRange);
    
    // Return debug info if requested
    if (includeDebug && result.debug) {
      return NextResponse.json({
        ...result,
        debug: result.debug,
      });
    }

    const { debug, ...publicResult } = result;
    return NextResponse.json(publicResult);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}

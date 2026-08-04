import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * DEPRECATED: Use /api/parsing/sync instead.
 * 
 * This endpoint is no longer functional as the legacy gmail.ts module has been removed.
 * New code should use the Phase 1-2 parsing pipeline via /api/parsing/sync.
 */
export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use /api/parsing/sync instead.",
      note: "The legacy sync implementation has been removed. Please migrate to the Phase 1-2 parsing pipeline.",
    },
    { status: 410 } // 410 Gone
  );
}

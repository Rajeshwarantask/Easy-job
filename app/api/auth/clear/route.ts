import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Re-enable after fixing build issue
  return NextResponse.json({ cleared: true });
}

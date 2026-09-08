import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGmailEmails } from "@/lib/parsing/sync-orchestrator";
import { dedupeByGmailMessageId } from "@/lib/parsing/deterministic-fallbacks";
import type { ParseResult } from "@/lib/parsing/types";

const GMAIL_API = "https://www.googleapis.com/gmail/v1/users/me";
const RECRUITMENT_QUERY = [
  "(application OR applied OR candidate OR interview OR assessment OR offer OR recruitment OR recruiter OR hiring OR shortlist OR rejected OR \"moving forward\")",
  "(from:(indeed.com OR linkedin.com OR greenhouse.io OR lever.co OR workday.com OR ashbyhq.com) OR subject:(application OR interview OR assessment OR offer OR rejection))",
].join(" ");

type GmailMessage = {
  id: string;
  threadId: string;
  payload?: Record<string, unknown>;
  snippet?: string;
  internalDate?: string;
};

async function gmailFetch(path: string, accessToken: string) {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Gmail access expired. Please re-authenticate.");
    throw new Error(`Gmail API error ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function toDashboardApplication(application: NonNullable<ParseResult["application"]>) {
  const original = application.originalEmail;
  const eventType = String(application.eventType || "update").toLowerCase();
  const status = eventType.includes("reject")
    ? "rejected"
    : eventType.includes("offer")
      ? "offer"
      : eventType.includes("interview")
        ? "interview"
        : eventType.includes("assessment") || eventType.includes("test")
          ? "assessment"
          : "applied";
  const date = original?.date instanceof Date ? original.date.toISOString() : original?.date ? new Date(original.date).toISOString() : null;
  const interviewEvent = application.timelineEvents?.find((event) => event.type === "interview");

  return {
    ...application,
    id: original?.gmailMessageId || application.applicationId || crypto.randomUUID(),
    company: application.company || "",
    role: application.role || null,
    location: application.location || null,
    status,
    platform: application.parsedBy || "gmail",
    appliedDate: date,
    lastUpdated: date,
    interviewDate: interviewEvent?.date instanceof Date ? interviewEvent.date.toISOString() : null,
    interviewTime: interviewEvent?.time || null,
    interviewLink: interviewEvent?.details?.interviewLink || null,
    timezone: interviewEvent?.timezone || null,
    jobUrl: application.jobUrl || null,
    assessmentLink: null,
    recruiterName: null,
    recruiterEmail: null,
    salary: null,
    gmailThreadId: original?.gmailThreadId || null,
    parserVersion: application.parserVersion || "1.0.0",
    confidence: application.parserConfidence || 0,
    originalEmail: original,
    parserApplication: application,
  };
}

async function fetchAllMessageIds(accessToken: string) {
  const ids: Array<{ id: string; threadId: string }> = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: RECRUITMENT_QUERY, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch(`/messages?${params.toString()}`, accessToken);
    ids.push(...(page.messages ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

export async function POST() {
  const startTime = Date.now();
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const accessToken = session.accessToken;
    if (!accessToken) return NextResponse.json({ error: "No Gmail access token. Please re-authenticate." }, { status: 401 });

    const diagnostics = { messagesFetched: 0, parsed: 0, skipped: 0, deduplicated: 0, errors: [] as string[] };
    const ids = await fetchAllMessageIds(accessToken);
    diagnostics.messagesFetched = ids.length;
    const dedupedIds = dedupeByGmailMessageId(ids);
    diagnostics.deduplicated = dedupedIds.deduplicated;

    const messages: GmailMessage[] = [];
    for (const item of dedupedIds.messages) {
      try {
        messages.push(await gmailFetch(`/messages/${encodeURIComponent(item.id)}?format=full`, accessToken));
      } catch (error) {
        diagnostics.errors.push(`${item.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ processed: 0, applications: [], errors: diagnostics.errors, diagnostics, syncDurationMs: Date.now() - startTime, syncedAt: new Date().toISOString() });
    }

    const result = await syncGmailEmails(messages, {
      userId: session.user.id,
      gmailThreadId: messages[0]?.threadId,
      existingApplications: [],
    });
    const successful = result.results.filter((entry: ParseResult) => entry.success && entry.application);
    diagnostics.parsed = successful.length;
    diagnostics.skipped = result.results.length - successful.length;

    return NextResponse.json({
      processed: result.processed,
      applications: successful.map((entry) => toDashboardApplication(entry.application!)),
      errors: [...diagnostics.errors, ...result.errors.map((entry) => `${entry.gmailMessageId ?? "unknown"}: ${entry.error}`)],
      diagnostics,
      syncDurationMs: Date.now() - startTime,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ processed: 0, applications: [], errors: [message], diagnostics: { messagesFetched: 0, parsed: 0, skipped: 0, deduplicated: 0, errors: [message] }, syncDurationMs: Date.now() - startTime, syncedAt: new Date().toISOString() }, { status: message.includes("expired") ? 401 : 500 });
  }
}

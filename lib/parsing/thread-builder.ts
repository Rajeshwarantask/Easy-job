// Email threading builder - groups emails by Gmail thread ID
// Builds timeline of application progression from email sequence

import type { EmailThread, ThreadTimelineEvent, ThreadGrouping } from "@/lib/thread-types";

interface EmailEventData {
  id: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  email_from: string;
  email_subject: string;
  email_date: Date;
  event_type: string;
  event_confidence: number;
  email_body_preview?: string;
}

/**
 * Build email thread from sequence of emails
 * Groups emails by gmail_thread_id and extracts timeline
 */
export function buildEmailThread(
  applicationId: string,
  emails: EmailEventData[]
): Partial<EmailThread> {
  if (emails.length === 0) {
    throw new Error("Cannot build thread from empty email list");
  }

  // Sort by date
  const sorted = [...emails].sort(
    (a, b) => new Date(a.email_date).getTime() - new Date(b.email_date).getTime()
  );

  const firstEmail = sorted[0];
  const lastEmail = sorted[sorted.length - 1];

  // Extract sender info from most common sender (usually the ATS)
  const senderCounts: Record<string, number> = {};
  sorted.forEach((email) => {
    senderCounts[email.email_from] = (senderCounts[email.email_from] || 0) + 1;
  });
  const primarySender = Object.entries(senderCounts).sort(
    (a, b) => b[1] - a[1]
  )[0][0];

  const senderDomain = extractDomain(primarySender);

  // Extract status progression from event types
  const statusProgression = extractStatusProgression(sorted);

  // Extract interview dates and links from body previews
  const interviewDates = extractInterviewDates(sorted);
  const hasInterviewLink = sorted.some(
    (email) =>
      email.email_body_preview?.toLowerCase().includes("interview") &&
      email.email_body_preview?.includes("http")
  );

  // Check for offer
  const hasOffer = sorted.some((email) =>
    email.event_type?.toLowerCase().includes("offer")
  );

  // Calculate days since last contact
  const today = new Date();
  const daysSinceLastContact = Math.floor(
    (today.getTime() - new Date(lastEmail.email_date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  // Estimate next action based on status
  const estimatedNextAction = estimateNextAction(statusProgression);

  // Extract subject prefix (remove thread indicators like Re:, Fwd:)
  const subjectPrefix = firstEmail.email_subject
    ?.replace(/^(Re:|Fwd:|FW:)\s*/gi, "")
    .substring(0, 500) || null;

  return {
    gmail_thread_id: firstEmail.gmail_thread_id,
    subject_prefix: subjectPrefix,
    primary_sender: primarySender,
    sender_domain: senderDomain,
    first_email_date: new Date(firstEmail.email_date),
    last_email_date: new Date(lastEmail.email_date),
    email_count: emails.length,
    status_progression: statusProgression,
    last_status_change: extractLastStatusChangeDate(sorted),
    estimated_next_action: estimatedNextAction,
    days_since_last_contact: daysSinceLastContact,
    has_interview_link: hasInterviewLink,
    interview_dates: interviewDates,
    has_offer: hasOffer,
  };
}

/**
 * Extract email domain from sender address
 */
function extractDomain(email: string): string {
  const match = email.match(/@([a-z0-9.-]+)/i);
  return match ? match[1] : "unknown";
}

/**
 * Extract status progression from email event types
 * Builds timeline like: ['applied', 'assessment', 'interview', 'offer']
 */
function extractStatusProgression(emails: EmailEventData[]): string[] {
  const progression: string[] = [];
  const seen = new Set<string>();

  emails.forEach((email) => {
    const status = normalizeEventType(email.event_type);
    if (status && !seen.has(status)) {
      progression.push(status);
      seen.add(status);
    }
  });

  return progression;
}

/**
 * Normalize event type to standard status
 */
function normalizeEventType(eventType: string): string | null {
  if (!eventType) return null;

  const normalized = eventType.toLowerCase();

  if (normalized.includes("reject")) return "rejection";
  if (normalized.includes("offer")) return "offer";
  if (normalized.includes("interview")) return "interview";
  if (normalized.includes("assess") || normalized.includes("screen"))
    return "assessment";
  if (normalized.includes("applied") || normalized.includes("application"))
    return "applied";

  return null;
}

/**
 * Extract interview dates from email content
 */
function extractInterviewDates(emails: EmailEventData[]): Date[] {
  const dates: Date[] = [];

  emails.forEach((email) => {
    if (!email.email_body_preview) return;

    // Look for patterns like "Dec 15", "December 15, 2024", "2024-12-15"
    const datePatterns = [
      /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g, // MM/DD/YYYY or DD-MM-YYYY
      /([A-Za-z]+\s+\d{1,2}(?:,?\s+\d{4})?)/g, // December 15, 2024
    ];

    for (const pattern of datePatterns) {
      const matches = email.email_body_preview.matchAll(pattern);
      for (const match of matches) {
        try {
          const parsed = new Date(match[1]);
          if (parsed instanceof Date && !isNaN(parsed.getTime())) {
            dates.push(parsed);
          }
        } catch {
          // Skip invalid dates
        }
      }
    }
  });

  return dates;
}

/**
 * Get the date of the last status change
 */
function extractLastStatusChangeDate(emails: EmailEventData[]): Date | null {
  // Find the email with the most advanced status
  const advancementOrder = ["applied", "assessment", "interview", "offer"];

  let lastStatusEmail: EmailEventData | null = null;
  let highestOrder = -1;

  emails.forEach((email) => {
    const status = normalizeEventType(email.event_type);
    const order = advancementOrder.indexOf(status || "");
    if (order > highestOrder) {
      highestOrder = order;
      lastStatusEmail = email;
    }
  });

  return lastStatusEmail ? new Date(lastStatusEmail.email_date) : null;
}

/**
 * Estimate what should happen next based on status progression
 */
function estimateNextAction(progression: string[]): string | null {
  if (progression.length === 0) return "Waiting for initial response";

  const lastStatus = progression[progression.length - 1];

  const nextSteps: Record<string, string> = {
    applied: "Waiting for screening response",
    assessment: "Complete assessment and wait for interview scheduling",
    interview: "Prepare for interview and await decision",
    offer: "Review offer and make decision",
    rejection: "Application rejected - consider other opportunities",
  };

  return nextSteps[lastStatus] || null;
}

/**
 * Build timeline events from email thread
 */
export function buildTimelineEvents(
  threadId: string,
  emails: EmailEventData[]
): ThreadTimelineEvent[] {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.email_date).getTime() - new Date(b.email_date).getTime()
  );

  const events: ThreadTimelineEvent[] = [];
  const statuses = new Set<string>();
  let eventOrder = 0;

  sorted.forEach((email, index) => {
    const status = normalizeEventType(email.event_type);

    if (status && !statuses.has(status)) {
      statuses.add(status);

      events.push({
        id: `${threadId}-event-${eventOrder}`,
        thread_id: threadId,
        event_order: eventOrder++,
        event_type: status as any,
        title: formatEventTitle(status),
        description: email.email_subject || null,
        event_date: new Date(email.email_date),
        email_id: email.id,
        created_at: new Date(),
      });
    }
  });

  return events;
}

/**
 * Format event type into human-readable title
 */
function formatEventTitle(eventType: string): string {
  const titles: Record<string, string> = {
    applied: "Application Submitted",
    assessment: "Assessment/Screening",
    interview: "Interview Scheduled",
    offer: "Offer Received",
    rejection: "Application Rejected",
    status_update: "Status Update",
  };

  return titles[eventType] || eventType;
}

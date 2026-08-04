/**
 * Timeline Builder
 * 
 * Converts parsed email facts into structured timeline events.
 * Separates parsing (what we extracted) from interpretation (what it means).
 */

import type { TimelineEvent, TimelineEventType, ParsedApplication } from "./types";
import type { ParserResult } from "./parser-interface";

/**
 * Build timeline events from a parser result.
 * 
 * A single email can contain multiple events:
 * - "Interview scheduled for Jan 15 at 10am with John" → interview event
 * - "Please complete this assessment by Jan 12" → assessment event + deadline
 * 
 * @param parsed - Parser result with extracted data
 * @returns Array of timeline events
 */
export function buildTimelineEvents(parsed: ParserResult): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Primary event from event type classification
  events.push({
    type: parsed.eventType.value as TimelineEventType,
    details: {},
    confidence: parsed.eventType.confidence,
  });

  // Build event details based on event type
  const primary = events[0];

  if (parsed.eventType.value === "interview") {
    // Interview event
    if (parsed.eventDetails.interviewDate) {
      primary.date = parsed.eventDetails.interviewDate.value;
    }
    if (parsed.eventDetails.interviewTime) {
      primary.time = parsed.eventDetails.interviewTime.value;
    }
    if (parsed.eventDetails.interviewTimezone) {
      primary.timezone = parsed.eventDetails.interviewTimezone.value;
    }

    // Interview details
    if (parsed.eventDetails.interviewLink) {
      primary.details.interviewLink = parsed.eventDetails.interviewLink.value;
    }
    if (parsed.eventDetails.interviewerName) {
      primary.details.interviewerName = parsed.eventDetails.interviewerName.value;
    }
    if (parsed.eventDetails.interviewerEmail) {
      primary.details.interviewerEmail = parsed.eventDetails.interviewerEmail.value;
    }

    // If there's an assessment mention too, create a secondary event
    if (parsed.eventDetails.assessmentType) {
      events.push({
        type: "assessment",
        date: parsed.eventDetails.assessmentDeadline?.value,
        details: {
          assessmentType: parsed.eventDetails.assessmentType.value,
          assessmentLink: parsed.eventDetails.assessmentLink?.value,
        },
        confidence: (parsed.eventDetails.assessmentType.confidence * 0.8), // Slightly lower since it's secondary
      });
    }
  } else if (parsed.eventType.value === "assessment") {
    // Assessment event
    if (parsed.eventDetails.assessmentType) {
      primary.details.assessmentType = parsed.eventDetails.assessmentType.value;
    }
    if (parsed.eventDetails.assessmentLink) {
      primary.details.assessmentLink = parsed.eventDetails.assessmentLink.value;
    }
    if (parsed.eventDetails.assessmentDeadline) {
      primary.date = parsed.eventDetails.assessmentDeadline.value;
    }
  } else if (parsed.eventType.value === "offer") {
    // Offer event
    if (parsed.eventDetails.salary) {
      primary.details.salary = parsed.eventDetails.salary.value;
    }
    if (parsed.eventDetails.offerDeadline) {
      primary.date = parsed.eventDetails.offerDeadline.value;
      primary.details.offerDeadline = parsed.eventDetails.offerDeadline.value;
    }
    if (parsed.eventDetails.startDate) {
      primary.details.startDate = parsed.eventDetails.startDate.value;
    }
  } else if (parsed.eventType.value === "rejection") {
    // Rejection event
    // No special details usually, but could have rejection reason
    if (parsed.eventDetails.rejectionReason) {
      primary.details.rejectionReason = parsed.eventDetails.rejectionReason.value;
    }
  } else if (parsed.eventType.value === "applied") {
    // Applied event — usually minimal details
    // Date should be the application date
    if (parsed.eventDetails.interviewDate) {
      primary.details.applicationReceivedDate = parsed.eventDetails.interviewDate.value;
    }
  }

  return events;
}

/**
 * Infer subsequent events based on timeline logic.
 * 
 * Examples:
 * - "Interview on Jan 15" + "Please complete assessment by Jan 12" → Assessment happens before interview
 * - "Offer expires Jan 30" → Implicit deadline event
 * 
 * For now, this is a placeholder for future enhancement.
 */
export function inferSubsequentEvents(events: TimelineEvent[]): TimelineEvent[] {
  // This would implement business logic like:
  // - If assessment deadline is after interview, reorder
  // - If offer deadline is present, create reminder event
  // - Infer "waiting" period between events
  
  // For now, return as-is
  return events;
}

/**
 * Calculate application status from timeline.
 * 
 * @param events - Timeline events in chronological order
 * @returns Current status: 'applied' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
 */
export function calculateApplicationStatus(
  events: TimelineEvent[]
): "applied" | "interview" | "offer" | "rejected" | "withdrawn" {
  // Most recent significant event determines status
  const significant = events.filter((e) =>
    ["applied", "interview", "offer", "rejection"].includes(e.type)
  );

  if (significant.length === 0) return "applied";

  const last = significant[significant.length - 1];
  switch (last.type) {
    case "offer":
      return "offer";
    case "rejection":
      return "rejected";
    case "interview":
      return "interview";
    case "applied":
    default:
      return "applied";
  }
}

/**
 * Get the next expected action from timeline.
 * 
 * @param events - Timeline events
 * @returns Description of next expected action (or null if none)
 */
export function getNextAction(events: TimelineEvent[]): string | null {
  // Find incomplete events that are pending action
  for (const event of events) {
    switch (event.type) {
      case "assessment":
        if (event.details.assessmentLink) {
          return `Complete assessment: ${event.details.assessmentLink}`;
        }
        if (event.date) {
          return `Assessment due by ${event.date.toLocaleDateString()}`;
        }
        return "Complete assessment";

      case "interview":
        if (event.date) {
          return `Interview scheduled for ${event.date.toLocaleDateString()} at ${event.time || "TBD"}`;
        }
        return "Interview scheduled";

      case "offer":
        if (event.details.offerDeadline) {
          return `Respond to offer by ${(event.details.offerDeadline as Date).toLocaleDateString()}`;
        }
        return "Review and respond to offer";

      default:
        break;
    }
  }

  return null;
}

/**
 * Format timeline for display.
 */
export interface FormattedTimeline {
  events: Array<{
    type: TimelineEventType;
    date: string;
    time?: string;
    summary: string;
  }>;
  status: "applied" | "interview" | "offer" | "rejected" | "withdrawn";
  nextAction?: string;
  lastUpdate: Date;
}

/**
 * Format timeline events for user display.
 */
export function formatTimeline(events: TimelineEvent[]): FormattedTimeline {
  const status = calculateApplicationStatus(events);
  const nextAction = getNextAction(events);

  const formatted = events
    .filter((e) => e.date) // Only dated events
    .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    .map((e) => ({
      type: e.type,
      date: e.date?.toLocaleDateString() || "",
      time: e.time,
      summary: summarizeEvent(e),
    }));

  return {
    events: formatted,
    status,
    nextAction: nextAction || undefined,
    lastUpdate: new Date(),
  };
}

/**
 * Summarize an event in human-readable form.
 */
function summarizeEvent(event: TimelineEvent): string {
  switch (event.type) {
    case "applied":
      return "Application submitted";

    case "assessment":
      const assessType = event.details.assessmentType || "Assessment";
      const deadline = event.date ? ` due ${event.date.toLocaleDateString()}` : "";
      return `${assessType}${deadline}`;

    case "interview":
      const time = event.time ? ` at ${event.time}` : "";
      const tz = event.timezone ? ` (${event.timezone})` : "";
      return `Interview scheduled${time}${tz}`;

    case "offer":
      if (event.details.salary) {
        return `Offer received - ${event.details.salary}`;
      }
      return "Offer received";

    case "rejection":
      return "Application rejected";

    default:
      return event.type.charAt(0).toUpperCase() + event.type.slice(1);
  }
}

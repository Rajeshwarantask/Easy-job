/**
 * Canonical normalization + status lifecycle helpers.
 *
 * This is the SINGLE source of truth for:
 *   - company name normalization (previously duplicated & divergent in
 *     `db.ts` and `application-resolver.ts`, which caused grouping mismatches)
 *   - job-title normalization
 *   - the application lifecycle stage ordering used to compute a monotonic
 *     final status (so a late "newsletter"/"update" email can never downgrade
 *     an application that already reached "offer" or "rejected").
 */

import type { JobStatus } from "./types";

const LEGAL_SUFFIXES = [
  "incorporated",
  "corporation",
  "technologies",
  "technology",
  "solutions",
  "services",
  "systems",
  "software",
  "labs",
  "studios",
  "studio",
  "group",
  "inc",
  "llc",
  "ltd",
  "pvt",
  "corp",
  "co",
  "gmbh",
  "plc",
  "sa",
  "ag",
];

const RECRUITMENT_NOISE = [
  "recruitment",
  "recruiting",
  "recruit",
  "careers",
  "career",
  "hiring",
  "talent",
  "team",
  "hr",
];

/**
 * Produce a canonical key for a company name. Lowercased, legal suffixes and
 * recruitment noise stripped, punctuation removed, whitespace collapsed.
 *
 * Returns a space-separated token string (NOT stripped of spaces) so that
 * containment / fuzzy checks in the resolver remain meaningful.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return "";
  const words = name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .filter((w) => !RECRUITMENT_NOISE.includes(w))
    .filter((w) => !LEGAL_SUFFIXES.includes(w));

  const normalized = words.join(" ").trim();
  // If stripping removed everything (e.g. company literally named "Talent"),
  // fall back to the alphanumeric-only original so we never return "".
  return normalized || name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Compact key with no spaces — handy for exact-equality dedupe maps. */
export function companyKey(name: string): string {
  return normalizeCompanyName(name).replace(/\s+/g, "");
}

/** Normalize a job title for grouping (weak signal — kept lenient). */
export function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null;
  const cleaned = role
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(the|a|an|for|position|role|opening|vacancy|opportunity)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

// ─────────────────────────────────────────────
// Lifecycle ordering
// ─────────────────────────────────────────────

/**
 * Fine-grained event types produced by the parsers, ordered by how far they
 * advance an application. Terminal states (offer/rejected) rank highest.
 */
export const EVENT_STAGE_RANK: Record<string, number> = {
  update: 0,
  applied: 1,
  screening: 2,
  assessment: 3,
  interview: 4,
  offer: 6,
  rejected: 5,
  withdrawn: 5,
};

/** Map a fine-grained event type to a coarse board `JobStatus`. */
export function eventTypeToStatus(eventType: string): JobStatus {
  const mapping: Record<string, JobStatus> = {
    update: "applied",
    applied: "applied",
    screening: "applied",
    assessment: "interview",
    interview: "interview",
    offer: "offer",
    rejected: "rejected",
    withdrawn: "withdrawn",
  };
  return mapping[eventType] ?? "applied";
}

/**
 * Compute the monotonic final status from a set of timeline events.
 *
 * Rules:
 *   - "rejected" and "offer" are terminal and, once present, win over active
 *     stages — EXCEPT that a later offer beats an earlier rejection and vice
 *     versa (the most recent terminal signal reflects reality).
 *   - Otherwise the furthest-advanced stage reached wins (monotonic), so a
 *     trailing generic "update" cannot pull an "interview" back to "applied".
 */
export function computeFinalStatus(
  events: Array<{ eventType: string; timestamp: string }>,
): JobStatus {
  if (events.length === 0) return "applied";

  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Most recent terminal event (offer/rejected/withdrawn) is authoritative.
  const terminal = [...sorted]
    .reverse()
    .find((e) => e.eventType === "offer" || e.eventType === "rejected" || e.eventType === "withdrawn");
  if (terminal) return eventTypeToStatus(terminal.eventType);

  // No terminal event — take the furthest-advanced non-terminal stage.
  let best = sorted[0];
  for (const e of sorted) {
    if ((EVENT_STAGE_RANK[e.eventType] ?? 0) > (EVENT_STAGE_RANK[best.eventType] ?? 0)) {
      best = e;
    }
  }
  return eventTypeToStatus(best.eventType);
}

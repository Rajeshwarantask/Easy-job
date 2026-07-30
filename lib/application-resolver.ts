/**
 * Application Resolver
 *
 * Collapses many recruitment emails into the small set of real applications
 * they belong to, and builds each application's timeline + final status.
 *
 * Matching signal priority (strongest → weakest):
 *   1. Gmail thread id       (same conversation = same application)
 *   2. Application id         (ATS-assigned, globally unique)
 *   3. Candidate id + company (candidate ref scoped to an employer)
 *   4. Normalized company + role
 *   5. Fuzzy company match    (transitive clustering, not adjacent-only)
 */

import { normalizeCompanyName, normalizeRole, computeFinalStatus } from "./normalize";
import type { JobStatus } from "./types";
import { createLogger } from "./logger";
import type { ExtractedFields } from "./extractors";

const log = createLogger("Resolver");

export interface ParsedEmailRecord {
  gmailId: string;
  from: string;
  subject: string;
  snippet: string;
  timestamp: string;
  threadId: string;
  company: string;
  role: string | null;
  eventType: string;
  confidence: number;
  fields?: Partial<ExtractedFields>;
}

export interface ResolvedApplication {
  company: string;
  company_normalized: string;
  role: string | null;
  events: Array<{ gmailId: string; eventType: string; timestamp: string }>;
  firstEventDate: string;
  lastEventDate: string;
  finalStatus: JobStatus;
  confidence: number;
  threadIds: string[];
  fields: Partial<ExtractedFields>;
}

/** Merge extracted fields across a group, keeping the first non-null value. */
function mergeFields(records: ParsedEmailRecord[]): Partial<ExtractedFields> {
  const merged: Partial<ExtractedFields> = {};
  const keys: (keyof ExtractedFields)[] = [
    "platform",
    "applicationId",
    "requisitionId",
    "candidateId",
    "interviewDate",
    "interviewTimeRaw",
    "timezone",
    "interviewLink",
    "assessmentLink",
    "codingPlatform",
    "deadline",
    "workMode",
    "location",
    "salaryRaw",
    "recruiterName",
    "recruiterEmail",
    "jobUrl",
    "careerPortalUrl",
  ];
  // Prefer values from the most recent emails first.
  const ordered = [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  for (const key of keys) {
    for (const r of ordered) {
      const v = r.fields?.[key];
      if (v !== undefined && v !== null && v !== "") {
        (merged as Record<string, unknown>)[key] = v;
        break;
      }
    }
  }
  return merged;
}

/** Stable key for the strongest deterministic signal available on a record. */
function primaryKey(r: ParsedEmailRecord): string {
  if (r.threadId) return `thread:${r.threadId}`;
  if (r.fields?.applicationId) return `app:${r.fields.applicationId}`;
  const company = normalizeCompanyName(r.company);
  if (r.fields?.candidateId) return `cand:${company}:${r.fields.candidateId}`;
  const role = normalizeRole(r.role) ?? "unknown";
  return `cr:${company}|${role}`;
}

function buildApplication(records: ParsedEmailRecord[]): ResolvedApplication {
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const events = sorted.map((e) => ({
    gmailId: e.gmailId,
    eventType: e.eventType,
    timestamp: e.timestamp,
  }));

  // Choose the best company label: the longest confident non-"Unknown" name.
  const named = sorted
    .filter((e) => e.company && e.company !== "Unknown Company")
    .sort((a, b) => b.confidence - a.confidence || b.company.length - a.company.length);
  const company = named[0]?.company ?? sorted[0].company;
  const role = sorted.map((e) => e.role).find((r) => r && r.trim()) ?? null;

  return {
    company,
    company_normalized: normalizeCompanyName(company),
    role,
    events,
    firstEventDate: sorted[0].timestamp,
    lastEventDate: sorted[sorted.length - 1].timestamp,
    finalStatus: computeFinalStatus(events),
    confidence: sorted.reduce((s, e) => s + e.confidence, 0) / sorted.length,
    threadIds: [...new Set(sorted.map((e) => e.threadId).filter(Boolean))],
    fields: mergeFields(sorted),
  };
}

/** Group emails into applications by the strongest deterministic key. */
export function resolveApplications(parsedEmails: ParsedEmailRecord[]): ResolvedApplication[] {
  const groups = new Map<string, ParsedEmailRecord[]>();
  for (const email of parsedEmails) {
    const key = primaryKey(email);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(email);
  }

  log.debug(`Grouped ${parsedEmails.length} emails into ${groups.size} raw applications`);
  return [...groups.values()].map(buildApplication);
}

// ─────────────────────────────────────────────
// Fuzzy merge (transitive / union-find, not adjacent-only)
// ─────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = Array.from({ length: b.length + 1 }, (_, j) => [j, ...Array(a.length).fill(0)]);
  for (let i = 0; i <= a.length; i++) m[0][i] = i;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[j][i] = Math.min(m[j][i - 1] + 1, m[j - 1][i] + 1, m[j - 1][i - 1] + cost);
    }
  }
  return m[b.length][a.length];
}

/**
 * Two company keys are "similar" if one clearly contains the other (word
 * boundary) or they differ by a small edit distance relative to their length.
 * Length-relative threshold prevents false merges of short names (Zeta/Meta).
 */
function isSimilarCompany(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  // Containment on word boundaries: "nest digital" ⊂ "nest digital recruit"
  if (longer.startsWith(shorter + " ") || longer.endsWith(" " + shorter) || longer.includes(" " + shorter + " ")) {
    return true;
  }
  if (shorter.length < 5) return false; // too short to fuzzy-merge safely
  const maxDist = shorter.length <= 8 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

/**
 * Merge applications whose companies are fuzzy-equal AND that don't have
 * conflicting distinct roles. Uses union-find so non-adjacent variants merge
 * transitively (A~B and B~C ⇒ A,B,C together).
 */
export function fuzzyMatchApplications(applications: ResolvedApplication[]): ResolvedApplication[] {
  const parent = applications.map((_, i) => i);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < applications.length; i++) {
    for (let j = i + 1; j < applications.length; j++) {
      const A = applications[i];
      const B = applications[j];
      if (!isSimilarCompany(A.company_normalized, B.company_normalized)) continue;
      // Don't merge two clearly different roles at the same company.
      const ra = normalizeRole(A.role);
      const rb = normalizeRole(B.role);
      if (ra && rb && ra !== rb && !ra.includes(rb) && !rb.includes(ra)) continue;
      union(i, j);
    }
  }

  const clusters = new Map<number, ResolvedApplication[]>();
  applications.forEach((app, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(app);
  });

  const merged: ResolvedApplication[] = [];
  for (const group of clusters.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    const allEvents = group
      .flatMap((a) => a.events)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    // Best label = highest-confidence, then longest name.
    const best = [...group].sort((a, b) => b.confidence - a.confidence || b.company.length - a.company.length)[0];
    log.debug(`Merged ${group.length} variants into "${best.company}" (${allEvents.length} events)`);
    merged.push({
      company: best.company,
      company_normalized: best.company_normalized,
      role: group.map((g) => g.role).find((r) => r) ?? null,
      events: allEvents,
      firstEventDate: allEvents[0].timestamp,
      lastEventDate: allEvents[allEvents.length - 1].timestamp,
      finalStatus: computeFinalStatus(allEvents),
      confidence: Math.max(...group.map((a) => a.confidence)),
      threadIds: [...new Set(group.flatMap((g) => g.threadIds))],
      fields: Object.assign({}, ...group.map((g) => g.fields)),
    });
  }

  log.debug(`Fuzzy merge: ${applications.length} → ${merged.length} applications`);
  return merged;
}

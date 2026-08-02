/**
 * JobTrail Parsing Module
 * 
 * Complete email parsing pipeline for recruitment emails.
 * Decoupled from persistence — returns ParsedApplication objects for caller to persist.
 */

// Foundation modules
export { decodeMimePayload, type GmailMessagePart, type DecodedMimeEmail } from "./mime-decoder";
export { cleanHtml, extractBodyText, extractAllLinks, type CleanedHtml, type ExtractedLink } from "./html-cleaner";
export { filterRecruitmentEmail, shouldParseEmail, type FilterResult } from "./recruitment-filter";

// Platform detection and parsing
export { detectPlatform, isPlatformConfident, type PlatformDetectionResult } from "./platform-detector";
export type { PlatformParser, ParserResult, ExtractedField } from "./parser-interface";
export { parseEmail, diagnoseEmail } from "./parsers";

// Quality layers
export { validateParsedApplication, shouldAutoSave, suggestManualReview, type ValidationResult } from "./validation";
export { normalizeCompanyName, normalizeRole, enrichParsedApplication, type EnrichedParserResult } from "./enrichment";
export { mapApplicationToExisting, findSimilarApplications, type MappingContext } from "./application-mapper";
export { buildTimelineEvents, calculateApplicationStatus, getNextAction, formatTimeline, type FormattedTimeline } from "./timeline-builder";

// Core types
export type {
  ParsedApplication,
  TimelineEvent,
  TimelineEventType,
  MappingDecision,
  ParseResult,
  SyncResult,
} from "./types";

// Orchestration
export {
  processSingleEmail,
  syncGmailEmails,
  summarizeSyncResult,
  type ProcessingSteps,
} from "./sync-orchestrator";

/**
 * Quick-start: Parse an email in one call
 * 
 * @example
 * ```typescript
 * import { parseEmailFull } from '@/lib/parsing';
 * 
 * const result = await parseEmailFull(
 *   gmailPayload,
 *   { userId: 'user123' }
 * );
 * 
 * if (result.success) {
 *   const application = result.application;
 *   // Do something with application (persist, cache, etc)
 * }
 * ```
 */
export async function parseEmailFull(
  gmailMessage: {
    id: string;
    threadId: string;
    payload?: any;
    snippet?: string;
  },
  context: {
    userId: string;
    existingApplications?: Array<{
      id: string;
      gmailThreadId?: string;
      company: string;
      role: string;
      createdAt: Date;
    }>;
  },
  options = {}
) {
  const { processSingleEmail } = await import("./sync-orchestrator");
  return processSingleEmail(
    gmailMessage,
    {
      userId: context.userId,
      gmailThreadId: gmailMessage.threadId,
      existingApplications: context.existingApplications,
    },
    options
  );
}

/**
 * Platform Parser Interface
 * 
 * All platform-specific parsers implement this interface.
 * Each parser is responsible for extracting:
 * - Application core fields (company, role, location)
 * - Event type and details
 * - ATS-specific fields (application ID, requisition ID, etc)
 */

import type { TimelineEventType } from "./types";

/**
 * Extracted field with confidence score.
 */
export interface ExtractedField<T> {
  value: T;
  confidence: number; // 0-1
}

/**
 * Parser result for a single email.
 */
export interface ParserResult {
  // Core application fields
  company?: ExtractedField<string>;
  role?: ExtractedField<string>;
  location?: ExtractedField<string>;
  workMode?: ExtractedField<"remote" | "hybrid" | "onsite">;

  // Event classification
  eventType: ExtractedField<TimelineEventType>;

  // Event details (varies by event type)
  eventDetails: {
    // Interview details
    interviewDate?: ExtractedField<Date>;
    interviewTime?: ExtractedField<string>;
    interviewTimezone?: ExtractedField<string>;
    interviewLink?: ExtractedField<string>;
    interviewerName?: ExtractedField<string>;
    interviewerEmail?: ExtractedField<string>;

    // Assessment details
    assessmentType?: ExtractedField<string>;
    assessmentLink?: ExtractedField<string>;
    assessmentDeadline?: ExtractedField<Date>;

    // Offer details
    salary?: ExtractedField<string>;
    offerDeadline?: ExtractedField<Date>;
    startDate?: ExtractedField<Date>;

    // Generic
    [key: string]: ExtractedField<any> | undefined;
  };

  // ATS-specific fields
  atsFields: {
    applicationId?: string;
    requisitionId?: string;
    candidateId?: string;
  };

  // Links
  jobUrl?: string;
  careerPortalUrl?: string;

  // Parser metadata
  parserConfidence: number; // Overall confidence (0-1)
  rawPatternMatches?: Record<string, string | null>; // Debug: what patterns matched
  processingNotes?: string[]; // Debug: notes about extraction
}

/**
 * Platform parser interface.
 * Each platform (Indeed, Greenhouse, etc) implements this.
 */
export interface PlatformParser {
  platformId: string;
  platformName: string;

  /**
   * Determine if this parser can handle the email.
   * Used for router logic.
   */
  canHandle(from: string, subject: string): boolean;

  /**
   * Parse an email and extract structured data.
   * 
   * @param from - Sender email
   * @param subject - Email subject
   * @param body - Email body (plaintext)
   * @param html - Email body (HTML, if available)
   * @returns Parsed result with extracted fields and confidence scores
   */
  parse(
    from: string,
    subject: string,
    body: string,
    html?: string
  ): ParserResult | null;
}

/**
 * Utility to merge multiple parsed results.
 * When multiple parsers can handle an email, merge their results.
 */
export function mergeParserResults(results: (ParserResult | null)[]): ParserResult {
  const validResults = results.filter((r) => r !== null) as ParserResult[];

  if (validResults.length === 0) {
    return {
      eventType: { value: "update", confidence: 0 },
      eventDetails: {},
      atsFields: {},
      parserConfidence: 0,
    };
  }

  if (validResults.length === 1) {
    return validResults[0];
  }

  // Merge multiple results — take highest confidence for each field
  const merged: ParserResult = {
    eventType: validResults.reduce((best, r) => 
      r.eventType.confidence > best.eventType.confidence ? r.eventType : best
    ).eventType,
    eventDetails: {},
    atsFields: {},
    parserConfidence: 0,
  };

  // Merge each field, preferring highest confidence
  if (validResults.some((r) => r.company)) {
    merged.company = validResults
      .filter((r) => r.company)
      .reduce((best, r) => 
        (r.company!.confidence > best.confidence) ? r.company! : best
      );
  }

  if (validResults.some((r) => r.role)) {
    merged.role = validResults
      .filter((r) => r.role)
      .reduce((best, r) => 
        (r.role!.confidence > best.confidence) ? r.role! : best
      );
  }

  if (validResults.some((r) => r.location)) {
    merged.location = validResults
      .filter((r) => r.location)
      .reduce((best, r) => 
        (r.location!.confidence > best.confidence) ? r.location! : best
      );
  }

  // Merge event details (combine all)
  for (const result of validResults) {
    for (const [key, value] of Object.entries(result.eventDetails)) {
      if (value && !merged.eventDetails[key]) {
        merged.eventDetails[key] = value;
      } else if (value && merged.eventDetails[key]) {
        // Prefer higher confidence
        const existing = merged.eventDetails[key];
        if (value.confidence > existing.confidence) {
          merged.eventDetails[key] = value;
        }
      }
    }
  }

  // Merge ATS fields (first non-empty wins)
  for (const result of validResults) {
    if (result.atsFields.applicationId && !merged.atsFields.applicationId) {
      merged.atsFields.applicationId = result.atsFields.applicationId;
    }
    if (result.atsFields.requisitionId && !merged.atsFields.requisitionId) {
      merged.atsFields.requisitionId = result.atsFields.requisitionId;
    }
    if (result.atsFields.candidateId && !merged.atsFields.candidateId) {
      merged.atsFields.candidateId = result.atsFields.candidateId;
    }
  }

  // Merge links (first non-empty wins)
  if (validResults.some((r) => r.jobUrl)) {
    merged.jobUrl = validResults.find((r) => r.jobUrl)?.jobUrl;
  }
  if (validResults.some((r) => r.careerPortalUrl)) {
    merged.careerPortalUrl = validResults.find((r) => r.careerPortalUrl)?.careerPortalUrl;
  }

  // Average confidence
  merged.parserConfidence = validResults.reduce((sum, r) => sum + r.parserConfidence, 0) / validResults.length;

  return merged;
}

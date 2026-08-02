/**
 * Sync Orchestrator
 * 
 * Main orchestration layer that coordinates the entire parsing pipeline:
 * 1. MIME decode
 * 2. HTML clean
 * 3. Recruitment filter
 * 4. Platform detection
 * 5. Platform parsing
 * 6. Validation
 * 7. Enrichment
 * 8. Application mapping
 * 9. Timeline building
 * 10. Return ParsedApplication (no DB writes)
 */

import { decodeMimePayload, type GmailMessagePart } from "./mime-decoder";
import { cleanHtml, extractBodyText, extractAllLinks } from "./html-cleaner";
import { shouldParseEmail, filterRecruitmentEmail } from "./recruitment-filter";
import { detectPlatform } from "./platform-detector";
import { parseEmail } from "./parsers";
import { validateParsedApplication } from "./validation";
import { enrichParsedApplication } from "./enrichment";
import { mapApplicationToExisting, type MappingContext } from "./application-mapper";
import { buildTimelineEvents } from "./timeline-builder";
import type {
  ParsedApplication,
  ParseResult,
  SyncResult,
  TimelineEvent,
} from "./types";

/**
 * Single email processing result with detailed steps.
 */
export interface ProcessingSteps {
  step: string;
  status: "success" | "skipped" | "failed";
  durationMs: number;
}

/**
 * Process a single email through the entire pipeline.
 * 
 * @param gmailMessage - Gmail API message with payload
 * @param mappingContext - Context for application mapping (userId, existing apps)
 * @param options - Processing options
 * @returns Parse result with ParsedApplication or error
 */
export async function processSingleEmail(
  gmailMessage: {
    id: string;
    threadId: string;
    payload?: GmailMessagePart;
    snippet?: string;
  },
  mappingContext: MappingContext,
  options: {
    skipFiltering?: boolean;
  } = {}
): Promise<ParseResult> {
  const steps: ProcessingSteps[] = [];
  const startTime = Date.now();

  try {
    // Step 1: MIME Decode
    const mimeStart = Date.now();
    const decoded = decodeMimePayload(gmailMessage.payload, gmailMessage.id, gmailMessage.threadId);
    steps.push({
      step: "mime_decode",
      status: "success",
      durationMs: Date.now() - mimeStart,
    });

    // Step 2: HTML Clean
    const htmlStart = Date.now();
    const cleaned = cleanHtml(decoded.body.html);
    const bodyText = extractBodyText(decoded.body.plaintext, decoded.body.html);
    const links = extractAllLinks(bodyText, decoded.body.html);
    steps.push({
      step: "html_clean",
      status: "success",
      durationMs: Date.now() - htmlStart,
    });

    // Step 3: Recruitment Filter
    const filterStart = Date.now();
    if (!options.skipFiltering) {
      const filterResult = filterRecruitmentEmail(
        decoded.headers.subject,
        decoded.headers.from,
        gmailMessage.snippet || ""
      );

      if (!filterResult.isRecruiting && filterResult.confidence >= 0.8) {
        steps.push({
          step: "recruitment_filter",
          status: "skipped",
          durationMs: Date.now() - filterStart,
        });

        return {
          success: false,
          error: `Not a recruitment email (${filterResult.reason})`,
          errorType: "filter",
          processingSteps: steps,
        };
      }
    }
    steps.push({
      step: "recruitment_filter",
      status: "success",
      durationMs: Date.now() - filterStart,
    });

    // Step 4: Platform Detection
    const detectStart = Date.now();
    const platformDetection = detectPlatform(
      decoded.headers.from,
      decoded.headers.subject,
      bodyText
    );
    steps.push({
      step: "platform_detection",
      status: "success",
      durationMs: Date.now() - detectStart,
    });

    // Step 5: Platform Parsing
    const parseStart = Date.now();
    const parseResult = parseEmail(
      decoded.headers.from,
      decoded.headers.subject,
      bodyText,
      decoded.body.html
    );

    if (!parseResult) {
      steps.push({
        step: "platform_parse",
        status: "failed",
        durationMs: Date.now() - parseStart,
      });

      return {
        success: false,
        error: "Parser returned null result",
        errorType: "parse",
        processingSteps: steps,
      };
    }
    steps.push({
      step: "platform_parse",
      status: "success",
      durationMs: Date.now() - parseStart,
    });

    // Step 6: Validation
    const validateStart = Date.now();
    const validation = validateParsedApplication(parseResult);
    steps.push({
      step: "validation",
      status: validation.valid ? "success" : "success",
      durationMs: Date.now() - validateStart,
    });

    // Step 7: Enrichment
    const enrichStart = Date.now();
    const enriched = enrichParsedApplication(parseResult);
    steps.push({
      step: "enrichment",
      status: "success",
      durationMs: Date.now() - enrichStart,
    });

    // Step 8: Application Mapping
    const mapStart = Date.now();
    const mapDecision = mapApplicationToExisting(parseResult, mappingContext);
    steps.push({
      step: "application_mapping",
      status: "success",
      durationMs: Date.now() - mapStart,
    });

    // Step 9: Timeline Building
    const timelineStart = Date.now();
    const timelineEvents = buildTimelineEvents(parseResult);
    steps.push({
      step: "timeline_building",
      status: "success",
      durationMs: Date.now() - timelineStart,
    });

    // Step 10: Build ParsedApplication Result
    const extractionTime = Date.now() - startTime;

    const application: ParsedApplication = {
      // Original email data
      originalEmail: {
        gmailMessageId: gmailMessage.id,
        gmailThreadId: gmailMessage.threadId,
        from: decoded.headers.from,
        to: decoded.headers.to,
        subject: decoded.headers.subject,
        date: decoded.headers.date,
        bodyText,
      },

      // Parsed fields
      company: parseResult.company?.value,
      companyConfidence: parseResult.company?.confidence ?? 0,
      companySource: parseResult.company ? "parser" : undefined,

      role: parseResult.role?.value,
      roleConfidence: parseResult.role?.confidence ?? 0,
      roleSource: parseResult.role ? "parser" : undefined,

      location: parseResult.location?.value,
      locationConfidence: parseResult.location?.confidence ?? 0,
      locationSource: parseResult.location ? "parser" : undefined,

      workMode: parseResult.workMode?.value,
      workModeConfidence: parseResult.workMode?.confidence ?? 0,

      // ATS fields
      applicationId: parseResult.atsFields.applicationId,
      requisitionId: parseResult.atsFields.requisitionId,
      candidateId: parseResult.atsFields.candidateId,

      // Enrichment
      companyNormalized: enriched.enrichedFields.companyNormalized,
      enrichmentApplied: enriched.enrichmentApplied,

      // Timeline
      eventType: parseResult.eventType.value as any,
      timelineEvents,

      // Mapping
      mapTo: mapDecision,

      // Links
      jobUrl: parseResult.jobUrl,
      careerPortalUrl: parseResult.careerPortalUrl,

      // Parser metadata
      parsedBy: platformDetection.platform,
      parserVersion: "1.0.0",
      parserConfidence: parseResult.parserConfidence,
      parserReasoning: platformDetection.reasoning,

      // Validation
      validation: {
        valid: validation.valid,
        criticalIssues: validation.criticalIssues,
        overallConfidence: validation.overallConfidence,
        issues: [...validation.criticalIssues, ...validation.warnings],
      },

      // Audit trail
      extractedAt: new Date(),
      extractionDurationMs: extractionTime,
    };

    return {
      success: true,
      application,
      processingSteps: steps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      success: false,
      error: `Orchestration error: ${errorMessage}`,
      errorType: "parse",
      processingSteps: steps,
    };
  }
}

/**
 * Process multiple emails and return structured results.
 * 
 * @param gmailMessages - Array of Gmail messages
 * @param mappingContext - Context for application mapping
 * @param options - Processing options
 * @returns Sync result with all parsed applications
 */
export async function syncGmailEmails(
  gmailMessages: Array<{
    id: string;
    threadId: string;
    payload?: GmailMessagePart;
    snippet?: string;
  }>,
  mappingContext: MappingContext,
  options: {
    skipFiltering?: boolean;
    concurrency?: number;
  } = {}
): Promise<SyncResult> {
  const syncStart = Date.now();
  const results: ParseResult[] = [];
  const errors: Array<{
    gmailMessageId?: string;
    error: string;
    timestamp: Date;
  }> = [];

  // Process emails sequentially to avoid overwhelming resources
  // (In production, consider batching with controlled concurrency)
  for (const message of gmailMessages) {
    try {
      const result = await processSingleEmail(message, mappingContext, options);
      results.push(result);

      if (!result.success && result.error) {
        errors.push({
          gmailMessageId: message.id,
          error: result.error,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        gmailMessageId: message.id,
        error: errorMessage,
        timestamp: new Date(),
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    processed: gmailMessages.length,
    results,
    errors,
    syncDurationMs: Date.now() - syncStart,
    syncedAt: new Date(),
  };
}

/**
 * Convert SyncResult to summary for logging/debugging.
 */
export function summarizeSyncResult(result: SyncResult): {
  processed: number;
  successful: number;
  failed: number;
  syncDurationMs: number;
  applicationsCreated: number;
  applicationsUpdated: number;
} {
  const successfulResults = result.results.filter((r) => r.success && r.application);
  const created = successfulResults.filter((r) => r.application?.mapTo.action === "create").length;
  const updated = successfulResults.filter((r) => r.application?.mapTo.action === "update").length;

  return {
    processed: result.processed,
    successful: successfulResults.length,
    failed: result.errors.length,
    syncDurationMs: result.syncDurationMs,
    applicationsCreated: created,
    applicationsUpdated: updated,
  };
}

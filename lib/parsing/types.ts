/**
 * Core types for the JobTrail parsing pipeline.
 * 
 * These types represent the immutable, storage-agnostic output of the parser.
 * The caller decides what to do with ParsedApplication (persist, cache, etc).
 */

/**
 * Event types in an application timeline.
 */
export type TimelineEventType =
  | "applied"
  | "assessment"
  | "interview"
  | "offer"
  | "rejection"
  | "update";

/**
 * A single timeline event extracted from parsed email.
 * Multiple events can come from one email (e.g., "interview scheduled + link shared").
 */
export interface TimelineEvent {
  type: TimelineEventType;
  date?: Date;
  time?: string; // HH:MM or HH:MM-HH:MM format
  timezone?: string;
  
  // Event-specific details
  details: {
    // For interview events
    interviewer?: string;
    interviewerEmail?: string;
    interviewLink?: string;
    interviewType?: string; // "phone", "video", "onsite", etc.
    
    // For assessment/test events
    assessmentType?: string; // "coding", "questionnaire", "screening", etc.
    assessmentLink?: string;
    assessmentDeadline?: Date;
    
    // For offer events
    salary?: string;
    currency?: string;
    startDate?: Date;
    offerDeadline?: Date;
    
    // For rejection events
    rejectionReason?: string;
    
    // Generic details for any event type
    [key: string]: string | Date | undefined;
  };
  
  // Confidence that this event was correctly extracted
  confidence: number; // 0-1
}

/**
 * Mapping decision: does this email belong to an existing application?
 */
export interface MappingDecision {
  action: "create" | "update";
  applicationId?: string; // If updating, the ID of the existing application
  confidence: number; // 0-1
  reason: string; // e.g., "matched via thread ID", "similar company + role"
  deduplicationMethod?: "thread_id" | "app_id" | "candidate_id" | "requisition_id" | "similarity";
}

/**
 * Fully parsed application extracted from a recruitment email.
 * This is the immutable output of the parsing pipeline.
 * 
 * Contains all extracted data plus metadata about confidence and provenance.
 * The caller (API route) decides where to persist this.
 */
export interface ParsedApplication {
  // ─── Original Email Data ───
  originalEmail: {
    gmailMessageId: string;
    gmailThreadId: string;
    from: string;
    to?: string;
    subject: string;
    date: Date;
    bodyText: string; // plaintext version
  };

  // ─── Application Data (Main Fields) ───
  company?: string;
  companyConfidence: number; // 0-1
  companySource?: "domain" | "parser" | "enrichment";

  role?: string;
  roleConfidence: number; // 0-1
  roleSource?: "parser" | "inference";

  location?: string;
  locationConfidence: number;
  locationSource?: "parser" | "inference";

  workMode?: "remote" | "hybrid" | "onsite";
  workModeConfidence: number;

  // ─── ATS-Specific Fields (Platform Extraction) ───
  applicationId?: string;
  requisitionId?: string;
  candidateId?: string;
  
  // ─── Enrichment Results ───
  companyNormalized?: string; // Normalized company name (for deduplication)
  enrichmentApplied: string[]; // e.g., ["company_normalized", "role_inference", "date_inference"]

  // ─── Event Timeline ───
  eventType: TimelineEventType; // Primary event type for this email
  timelineEvents: TimelineEvent[]; // All extracted timeline events
  
  // ─── Application Mapping (Deduplication) ───
  mapTo: MappingDecision;

  // ─── Job Application Links ───
  jobUrl?: string;
  careerPortalUrl?: string;
  
  // ─── Parser Metadata ───
  parsedBy: string; // Platform identifier: "indeed", "greenhouse", "workday", "lever", "ashby", "generic"
  parserVersion: string;
  parserConfidence: number; // Overall parser confidence
  parserReasoning: string; // Human-readable explanation of why this was parsed this way

  // ─── Validation Results ───
  validation: {
    valid: boolean; // true if all critical fields passed validation
    criticalIssues: string[]; // Issues with required fields
    warnings: string[]; // Issues with optional fields
    overallConfidence: number; // 0-1
  };

  // ─── Audit Trail ───
  extractedAt: Date;
  extractionDurationMs: number;
}

/**
 * Result of the full parsing pipeline.
 * Returned by the sync orchestrator.
 */
export interface ParseResult {
  success: boolean;
  error?: string;
  errorType?: "filter" | "decode" | "parse" | "validation" | "mapping" | "timeline";
  application?: ParsedApplication;
  processingSteps: Array<{
    step: string;
    status: "success" | "skipped" | "failed";
    durationMs: number;
  }>;
}

/**
 * Sync orchestration result.
 * Returned to the API caller.
 */
export interface SyncResult {
  processed: number; // Total emails processed
  results: ParseResult[]; // Per-email results
  errors: Array<{
    gmailMessageId?: string;
    error: string;
    timestamp: Date;
  }>;
  syncDurationMs: number;
  syncedAt: Date;
}

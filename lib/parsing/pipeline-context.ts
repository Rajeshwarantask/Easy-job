/**
 * Unified Pipeline Context
 *
 * All stages read from and write to ONE context object.
 * This prevents stages from having different signatures.
 * Each stage only updates its own section, never modifies another stage's data.
 */

export interface NormalizedEmail {
  subject: string;
  from: string;
  fromEmail: string;
  date: Date;
  body: string;
  htmlBody?: string;
  links: string[];
  headers: Record<string, string>;
  threadId?: string;
  messageId?: string;
}

export interface EmailMetadata {
  platform?: string;
  senderName: string;
  senderDomain: string;
  urgencyScore: number;
  hasButtons: boolean;
  hasInterviewLink: boolean;
  buttonTexts: string[];
  keywordMatches: Record<string, number>;
}

export interface DocumentClassification {
  documentType:
    | "application_confirmation"
    | "assessment"
    | "interview_scheduling"
    | "interview_reminder"
    | "offer"
    | "rejection"
    | "recruiter_message"
    | "job_recommendation"
    | "status_update"
    | "deadline_reminder"
    | "marketing"
    | "unknown";
  confidence: number;
  reason: string;
}

export interface ExtractedField<T = any> {
  value: T;
  confidence: number;
  source: string; // Which extractor/regex found this?
  reasoning: string;
  alternatives?: Array<{ value: T; confidence: number }>;
}

export interface ExtractedFields {
  company: ExtractedField<string>;
  role: ExtractedField<string>;
  location?: ExtractedField<string>;
  workMode?: ExtractedField<"remote" | "onsite" | "hybrid">;
  salary?: ExtractedField<{
    min?: number;
    max?: number;
    currency: string;
  }>;
  recruiterName?: ExtractedField<string>;
  recruiterEmail?: ExtractedField<string>;
  jobUrl?: ExtractedField<string>;
  interviewDate?: ExtractedField<Date>;
  interviewTime?: ExtractedField<string>;
  interviewLink?: ExtractedField<string>;
  interviewLinkPlatform?: ExtractedField<string>;
  deadline?: ExtractedField<Date>;
  applicationId?: ExtractedField<string>;
  requisitionId?: ExtractedField<string>;
  candidateId?: ExtractedField<string>;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  warnings: string[];
  criticalIssues: string[];
  fieldConfidences: Record<string, number>;
}

export interface ResolvedFields {
  company: string;
  companyNormalized: string;
  role: string;
  location?: string;
  workMode?: "remote" | "onsite" | "hybrid";
  salary?: {
    min?: number;
    max?: number;
    currency: string;
  };
  recruiterName?: string;
  recruiterEmail?: string;
  jobUrl?: string;
  interviewDate?: Date;
  interviewTime?: string;
  interviewLink?: string;
  interviewLinkPlatform?: string;
  deadline?: Date;
  overallConfidence: number;
}

export interface StateAnalysis {
  currentState:
    | "applied"
    | "assessment"
    | "interview"
    | "offer"
    | "rejected"
    | "unknown";
  confidence: number;
  stateHistory: Array<{
    state: string;
    detectedFrom: string;
    date: Date;
  }>;
  nextExpectedState?: string;
  isValidTransition: boolean;
}

export interface TimelineEvent {
  type: string;
  date: Date;
  title: string;
  description?: string;
  details?: Record<string, any>;
  confidence: number;
}

export interface ParsedApplication {
  company: string;
  role: string;
  location?: string;
  workMode?: "remote" | "onsite" | "hybrid";
  salary?: {
    min?: number;
    max?: number;
    currency: string;
  };
  recruiter?: {
    name?: string;
    email?: string;
  };
  jobUrl?: string;
  eventType: string;
  currentState: string;
  stateHistory: Array<{ state: string; date: Date }>;
  timeline: TimelineEvent[];
  parserConfidence: number;
  parserVersion: string;
  pipelineVersion: string;
  ruleVersion: string;
  metadata: {
    platform: string;
    parsedBy: string;
    extractedFields: ExtractedFields;
    resolvedFields: ResolvedFields;
    validation: ValidationResult;
  };
}

export interface StageResult<T> {
  success: boolean;
  data: T;
  confidence: number;
  warnings: string[];
  metrics: {
    processingTimeMs: number;
    rulesApplied: string[];
  };
  next?: string; // Suggestion for next stage
}

export interface PipelineContext {
  // Raw input
  rawEmail: {
    subject: string;
    from: string;
    body: string;
    htmlBody?: string;
    headers: Record<string, string>;
    threadId?: string;
    messageId?: string;
  };

  // Stage: Normalization
  normalizedEmail?: NormalizedEmail;

  // Stage: Metadata Extraction
  metadata?: EmailMetadata;

  // Stage: Classification
  classification?: DocumentClassification;

  // Stage: Information Extraction
  extractedFields?: ExtractedFields;

  // Stage: Validation
  validation?: ValidationResult;

  // Stage: Resolution
  resolvedFields?: ResolvedFields;

  // Stage: Identity Resolution
  identityMatch?: {
    isNewApplication: boolean;
    matchedApplicationId?: string;
    matchedCompany?: string;
    matchedRole?: string;
    confidenceScore: number;
    signals: string[];
  };

  // Stage: State Analysis
  state?: StateAnalysis;

  // Stage: Timeline Generation
  timeline?: TimelineEvent[];

  // Stage: Application Builder
  application?: ParsedApplication;

  // Shared logging
  logs: Array<{
    stage: string;
    level: "info" | "warn" | "error";
    message: string;
    timestamp: Date;
  }>;

  // Pipeline metadata
  startTime: Date;
  pipelineVersion: string;
  ruleVersion: string;
}

export function createPipelineContext(rawEmail: PipelineContext["rawEmail"]): PipelineContext {
  return {
    rawEmail,
    logs: [],
    startTime: new Date(),
    pipelineVersion: "3.0.0",
    ruleVersion: new Date().toISOString().split("T")[0],
  };
}

/**
 * Pipeline Architecture
 * Each stage implements a common interface: input -> output
 * No stage knows the whole system. Only input and output.
 */

export interface StageOutput<T> {
  data: T;
  confidence: number; // 0-1
  reason: string; // Why this output?
  source: string; // Which parser/logic produced this?
  warnings: string[];
  processingTimeMs: number;
}

export interface Stage<I, O> {
  name: string;
  run(input: I): Promise<StageOutput<O>>;
}

export interface NormalizedEmail {
  subject: string;
  from: string;
  fromDomain: string;
  bodyText: string;
  bodyHtml: string;
  date: Date;
  threadId: string;
  messageId: string;
  links: Array<{ url: string; text: string }>;
  buttons: Array<{ text: string; url: string }>;
  headers: Record<string, string>;
}

export interface EmailMetadata {
  senderName: string | null;
  senderDomain: string;
  platform: string; // linkedin, workable, greenhouse, etc
  hasButtons: boolean;
  linkCount: number;
  wordCount: number;
  urgencyKeywords: string[];
}

export interface ClassifiedEmail {
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
}

export interface ExtractedFields {
  company: { value: string | null; confidence: number; source: string };
  role: { value: string | null; confidence: number; source: string };
  salary: {
    min: number | null;
    max: number | null;
    currency: string;
    confidence: number;
    source: string;
  };
  location: { value: string | null; confidence: number; source: string };
  workMode: {
    value: "remote" | "onsite" | "hybrid" | null;
    confidence: number;
    source: string;
  };
  recruiter: {
    name: string | null;
    email: string | null;
    confidence: number;
    source: string;
  };
  interviewDate: { value: Date | null; confidence: number; source: string };
  interviewLink: { value: string | null; confidence: number; source: string };
  applicationUrl: { value: string | null; confidence: number; source: string };
  deadline: { value: Date | null; confidence: number; source: string };
}

export interface ResolvedFields {
  company: string;
  role: string;
  salary: { min: number | null; max: number | null; currency: string };
  location: string | null;
  workMode: "remote" | "onsite" | "hybrid" | null;
  recruiter: { name: string | null; email: string | null };
  interviewDate: Date | null;
  interviewLink: string | null;
  applicationUrl: string | null;
  deadline: Date | null;
  confidence: number;
}

export interface IdentityMatch {
  isNewApplication: boolean;
  matchedApplicationId: string | null;
  matchConfidence: number;
  matchReason: string;
  mergeStrategy: "thread_id" | "recruiter" | "company_role" | "fuzzy" | null;
}

export interface ApplicationState {
  currentState: "applied" | "assessment" | "interview" | "offer" | "rejected";
  stateHistory: Array<{ state: string; date: Date }>;
  isValidTransition: boolean;
  confidence: number;
}

export interface TimelineEvent {
  type: string;
  date: Date;
  time: string | null;
  description: string;
  metadata: Record<string, any>;
}

export interface ParsedApplication {
  id: string; // Unique ID for this parsing result
  originalEmail: {
    threadId: string;
    messageId: string;
    date: Date;
    from: string;
  };
  documentType: string;
  company: string;
  role: string;
  salary: {
    min: number | null;
    max: number | null;
    currency: string;
  };
  location: string | null;
  workMode: "remote" | "onsite" | "hybrid" | null;
  recruiter: {
    name: string | null;
    email: string | null;
  };
  interviewDate: Date | null;
  interviewLink: string | null;
  applicationUrl: string | null;
  deadline: Date | null;
  currentState: "applied" | "assessment" | "interview" | "offer" | "rejected";
  timeline: TimelineEvent[];
  confidence: {
    overall: number;
    byField: Record<string, number>;
  };
  identity: IdentityMatch;
  metadata: {
    processingTimeMs: number;
    stages: Array<{ name: string; timeMs: number; warnings: string[] }>;
  };
}

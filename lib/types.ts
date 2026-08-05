/**
 * Types for a privacy-first Gmail parser.
 * 
 * Gmail is the only source of truth.
 * ParsedApplication[] is the parser's output.
 * sessionStorage temporarily caches the result during a browser session.
 * Dashboard visualizes the cache.
 */

// ─── Parser Output ────────────────────────────────────────────────────────────

export type ApplicationStatus = 
  | 'applied'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

/**
 * Output of the Gmail parsing pipeline.
 * Represents a single job application discovered from Gmail.
 */
export interface ParsedApplication {
  id: string;
  company: string;
  role: string | null;
  location: string | null;
  status: ApplicationStatus;
  
  // Recruitment platform detection
  platform: string | null;
  
  // Timeline
  appliedDate: string | null;
  lastUpdated: string | null;
  
  // Interview details
  interviewDate: string | null;
  interviewTime: string | null;
  interviewLink: string | null;
  timezone: string | null;
  
  // Application links
  jobUrl: string | null;
  assessmentLink: string | null;
  
  // Recruiter contact
  recruiterName: string | null;
  recruiterEmail: string | null;
  
  // Compensation
  salary: string | null;
  
  // Parser metadata
  gmailThreadId: string | null;
  parserVersion: string;
  confidence: number;
}

/**
 * Represents a single email event in the Gmail thread.
 */
export interface GmailEmailEvent {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  eventType: 'confirmation' | 'assessment' | 'interview' | 'offer' | 'rejection' | 'other';
}

/**
 * Session cache state.
 */
export interface SyncCache {
  applications: ParsedApplication[];
  lastSyncedAt: string | null;
}

// ─── UI Configuration ─────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bgColor: string }> = {
  applied: { label: 'Applied', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  assessment: { label: 'Assessment', color: 'text-purple-700', bgColor: 'bg-purple-50' },
  interview: { label: 'Interview', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  offer: { label: 'Offer', color: 'text-green-700', bgColor: 'bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-50' },
  withdrawn: { label: 'Withdrawn', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const KANBAN_COLUMNS: { id: ApplicationStatus; title: string }[] = [
  { id: 'applied', title: 'Applied' },
  { id: 'assessment', title: 'Assessment' },
  { id: 'interview', title: 'Interview' },
  { id: 'offer', title: 'Offer' },
  { id: 'rejected', title: 'Rejected' },
  { id: 'withdrawn', title: 'Withdrawn' },
];

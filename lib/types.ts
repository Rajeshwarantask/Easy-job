// Database types for JobTrail

export type JobStatus = 
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface JobApplication {
  id: string;
  user_id: string;
  company: string;
  company_normalized: string;
  role: string | null;
  role_normalized?: string | null;
  location: string | null;
  work_mode?: 'remote' | 'hybrid' | 'onsite' | null;
  platform: string | null;
  status: JobStatus;
  applied_date: string | null;
  last_activity: string | null;
  deadline?: string | null;
  deadline_label?: string | null;
  // Rich structured fields extracted from the email thread (optional so mock
  // and legacy data stay valid; the sync pipeline populates them fully).
  application_id?: string | null;
  requisition_id?: string | null;
  candidate_id?: string | null;
  interview_date?: string | null;
  interview_time?: string | null;
  timezone?: string | null;
  interview_link?: string | null;
  assessment_link?: string | null;
  coding_platform?: string | null;
  salary?: string | null;
  job_url?: string | null;
  career_portal_url?: string | null;
  recruiter_name?: string | null;
  recruiter_email?: string | null;
  confidence?: number;
  is_new_update: boolean;
  gmail_thread_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailEvent {
  id: string;
  job_id: string;
  user_id: string;
  event_type: string;
  email_subject: string | null;
  email_snippet: string | null;
  gmail_message_id: string | null;
  gmail_thread_id?: string | null;
  sender?: string | null;
  parsed_by: string | null;
  parser_version?: string | null;
  model_used?: string | null;
  confidence?: number | null;
  /** Full audit trail: raw email, normalized text, regex/ai/merged results */
  raw_email?: string | null;
  normalized_email?: string | null;
  regex_result?: Record<string, unknown> | null;
  ai_result?: Record<string, unknown> | null;
  merged_result?: Record<string, unknown> | null;
  raw_extracted: Record<string, unknown> | null;
  created_at: string;
}

// Extended types for UI
export interface JobWithEvents extends JobApplication {
  email_events?: EmailEvent[];
}

export interface KanbanColumn {
  id: JobStatus;
  title: string;
  jobs: JobApplication[];
}

// Status display configuration
export const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bgColor: string }> = {
  applied: { label: 'Applied', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  interview: { label: 'Interview', color: 'text-amber-700', bgColor: 'bg-amber-50' },
  offer: { label: 'Offer', color: 'text-green-700', bgColor: 'bg-green-50' },
  rejected: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-50' },
  withdrawn: { label: 'Withdrawn', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

export const KANBAN_COLUMNS: { id: JobStatus; title: string }[] = [
  { id: 'applied', title: 'Applied' },
  { id: 'interview', title: 'Interview' },
  { id: 'offer', title: 'Offer' },
  { id: 'rejected', title: 'Rejected' },
  { id: 'withdrawn', title: 'Withdrawn' },
];

// ─── Job Search (JSearch / RapidAPI) ─────────────────────────────────────────

export type JobSearchDateFilter = 'all' | 'today' | '3days' | 'week' | 'month';
export type JobSearchExpLevel = 'all' | 'no_experience' | 'under_3_years_experience' | 'more_than_3_years_experience';
export type JobSearchType = 'all' | 'FULLTIME' | 'PARTTIME' | 'INTERN' | 'CONTRACTOR';

export interface JobSearchFilters {
  query: string;
  location: string;
  remoteOnly: boolean;
  datePosted: JobSearchDateFilter;
  experienceLevel: JobSearchExpLevel;
  jobType: JobSearchType;
  salaryMin: number | null;
  salaryMax: number | null;
  page: number;
}

/** Raw result shape returned by JSearch (only the fields we use) */
export interface JSearchJob {
  job_id: string;
  job_title: string;
  employer_name: string;
  employer_logo: string | null;
  job_publisher: string;
  job_employment_type: string | null;
  job_apply_link: string;
  job_city: string | null;
  job_state: string | null;
  job_country: string | null;
  job_is_remote: boolean;
  job_posted_at_datetime_utc: string | null;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_salary_currency: string | null;
  job_salary_period: string | null;
  job_required_experience: {
    required_experience_in_months: number | null;
  } | null;
  job_description: string | null;
}

export interface JSearchResponse {
  data: JSearchJob[];
  status: string;
  request_id: string;
  parameters: Record<string, unknown>;
}

/** Normalised shape used in UI */
export interface JobSearchResult {
  id: string;
  title: string;
  company: string;
  companyLogo: string | null;
  source: string;
  employmentType: string | null;
  applyUrl: string;
  location: string | null;
  isRemote: boolean;
  postedAt: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  description: string | null;
}

/** Shape POSTed to /api/jobs when saving from search results */
export interface SaveToTrackerPayload {
  company: string;
  role: string;
  location: string | null;
  platform: string;
  status: 'applied';
  applied_date: string;
}

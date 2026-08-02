/**
 * Database Types for Phase 3
 * Types for applications, email events, and sync history
 */

export type ApplicationStatus = 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected' | 'archived';
export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type SyncStatus = 'in_progress' | 'completed' | 'failed';

/**
 * Application record stored in Supabase
 */
export interface Application {
  id: string;
  user_id: string;
  
  // Parsed application data
  company: string;
  company_normalized?: string;
  role: string;
  role_normalized?: string;
  location?: string;
  work_mode?: WorkMode;
  
  // ATS-specific identifiers
  application_id?: string;
  requisition_id?: string;
  candidate_id?: string;
  
  // Salary information
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  
  // Status tracking
  status: ApplicationStatus;
  last_event_type?: string;
  last_event_date?: string;
  
  // Interview details
  next_interview_date?: string;
  next_interview_time?: string;
  next_interview_link?: string;
  next_interview_link_platform?: string;
  interviewer_name?: string;
  interviewer_email?: string;
  
  // Offer details
  offer_deadline?: string;
  offer_status?: string;
  
  // Job posting information
  job_url?: string;
  career_portal_url?: string;
  
  // Confidence & quality metrics
  parser_confidence?: number;
  parsing_platform?: string;
  validation_score?: number;
  user_confidence?: number;
  
  // User interactions
  notes?: string;
  starred?: boolean;
  archived_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  synced_at?: string;
  last_email_thread_id?: string;
}

/**
 * Email event associated with an application
 */
export interface EmailEvent {
  id: string;
  user_id: string;
  application_id: string;
  
  // Gmail metadata
  gmail_message_id: string;
  gmail_thread_id: string;
  email_from?: string;
  email_subject?: string;
  
  // Event classification
  event_type?: string;
  event_confidence?: number;
  
  // Email content
  email_body_preview?: string;
  email_date?: string;
  
  // Parser output
  parsed_data?: Record<string, any>;
  parsing_platform?: string;
  
  // User actions
  marked_as?: boolean;
  
  // Metadata
  created_at: string;
}

/**
 * Sync history record
 */
export interface SyncHistory {
  id: string;
  user_id: string;
  
  // Sync metadata
  sync_start: string;
  sync_end?: string;
  
  // Results
  emails_processed: number;
  applications_created: number;
  applications_updated: number;
  emails_skipped: number;
  errors_count: number;
  
  // Status
  status: SyncStatus;
  error_message?: string;
  
  // Gmail date range
  from_date?: string;
  to_date?: string;
  
  created_at: string;
}

/**
 * Application with related email events
 */
export interface ApplicationWithEvents extends Application {
  email_events?: EmailEvent[];
}

/**
 * Dashboard statistics
 */
export interface DashboardStats {
  total_applications: number;
  by_status: Record<ApplicationStatus, number>;
  by_platform: Record<string, number>;
  average_parser_confidence: number;
  last_sync?: {
    date: string;
    count: number;
  };
}

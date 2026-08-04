// Email threading types for Phase 4

export type ThreadStatus = 'active' | 'archived' | 'rejected' | 'offer_accepted' | 'offer_declined';

export type ThreadEventType = 
  | 'applied'
  | 'assessment' 
  | 'interview'
  | 'offer'
  | 'rejection'
  | 'status_update'
  | 'interview_scheduled'
  | 'interview_completed';

export interface EmailThread {
  id: string;
  user_id: string;
  application_id: string;
  
  gmail_thread_id: string;
  thread_status: ThreadStatus;
  subject_prefix: string | null;
  
  primary_sender: string | null;
  sender_domain: string | null;
  
  first_email_date: Date;
  last_email_date: Date;
  email_count: number;
  
  status_progression: string[];
  last_status_change: Date | null;
  estimated_next_action: string | null;
  days_since_last_contact: number | null;
  
  has_interview_link: boolean;
  interview_dates: Date[];
  has_offer: boolean;
  
  created_at: Date;
  updated_at: Date;
}

export interface ThreadTimelineEvent {
  id: string;
  thread_id: string;
  
  event_order: number;
  event_type: ThreadEventType;
  
  title: string;
  description: string | null;
  event_date: Date | null;
  
  email_id: string | null;
  
  created_at: Date;
}

export interface ThreadWithEvents extends EmailThread {
  events: ThreadTimelineEvent[];
  email_count_summary: {
    total: number;
    by_sender: Record<string, number>;
    by_type: Record<string, number>;
  };
}

export interface ThreadGrouping {
  application_id: string;
  threads: EmailThread[];
  total_emails: number;
  status_timeline: ThreadTimelineEvent[];
  days_in_pipeline: number;
}

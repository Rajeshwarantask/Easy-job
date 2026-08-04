-- Phase 4: Email Threading Schema
-- Groups emails by conversation thread and tracks timeline progression

-- Create enum for thread status
CREATE TYPE thread_status AS ENUM ('active', 'archived', 'rejected', 'offer_accepted', 'offer_declined');

-- Email threads table - represents a single application conversation
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  
  -- Gmail thread identifier
  gmail_thread_id VARCHAR(255) NOT NULL,
  
  -- Thread metadata
  thread_status thread_status DEFAULT 'active',
  subject_prefix VARCHAR(500),
  
  -- Participant tracking
  primary_sender VARCHAR(255), -- The ATS or recruiter sending most emails
  sender_domain VARCHAR(255),  -- Domain of sender (indeed.com, greenhouse.io, etc)
  
  -- Thread timeline
  first_email_date TIMESTAMP WITH TIME ZONE,
  last_email_date TIMESTAMP WITH TIME ZONE,
  email_count INTEGER DEFAULT 1,
  
  -- Event progression
  status_progression VARCHAR(50)[], -- Array of status changes: ['applied', 'assessment', 'interview', 'offer']
  last_status_change TIMESTAMP WITH TIME ZONE,
  estimated_next_action VARCHAR(255),
  days_since_last_contact INTEGER,
  
  -- Analysis
  has_interview_link BOOLEAN DEFAULT FALSE,
  interview_dates TIMESTAMP WITH TIME ZONE[],
  has_offer BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_thread_per_app UNIQUE(application_id, gmail_thread_id)
);

-- Create indexes
CREATE INDEX idx_threads_user_id ON email_threads(user_id);
CREATE INDEX idx_threads_application_id ON email_threads(application_id);
CREATE INDEX idx_threads_gmail_thread_id ON email_threads(user_id, gmail_thread_id);
CREATE INDEX idx_threads_status ON email_threads(user_id, thread_status);
CREATE INDEX idx_threads_last_contact ON email_threads(user_id, last_email_date DESC);

-- Add thread_id reference to email_events
ALTER TABLE email_events 
ADD COLUMN thread_id UUID REFERENCES email_threads(id) ON DELETE CASCADE;

-- Create index for email_events thread lookup
CREATE INDEX idx_email_events_thread_id ON email_events(thread_id);

-- Timeline events view - denormalized view of thread progression
CREATE TABLE thread_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  
  -- Event sequence
  event_order INTEGER NOT NULL,
  event_type VARCHAR(50), -- 'applied', 'assessment', 'interview', 'offer', 'rejection', 'status_update'
  
  -- Event details
  title VARCHAR(255),
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  
  -- Associated email
  email_id UUID REFERENCES email_events(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_timeline_order UNIQUE(thread_id, event_order)
);

CREATE INDEX idx_timeline_thread_id ON thread_timeline_events(thread_id, event_order);

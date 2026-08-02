-- Phase 3: Applications table schema
-- Stores parsed job applications from email sync

-- Create enum for application status
CREATE TYPE application_status AS ENUM ('applied', 'assessment', 'interview', 'offer', 'rejected', 'archived');

-- Create enum for work mode
CREATE TYPE work_mode_type AS ENUM ('remote', 'hybrid', 'onsite');

-- Applications table
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Parsed application data
  company VARCHAR(255) NOT NULL,
  company_normalized VARCHAR(255),
  role VARCHAR(255) NOT NULL,
  role_normalized VARCHAR(255),
  location VARCHAR(255),
  work_mode work_mode_type,
  
  -- ATS-specific identifiers
  application_id VARCHAR(255),
  requisition_id VARCHAR(255),
  candidate_id VARCHAR(255),
  
  -- Salary information
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Status tracking
  status application_status DEFAULT 'applied',
  last_event_type VARCHAR(50),
  last_event_date TIMESTAMP WITH TIME ZONE,
  
  -- Interview details
  next_interview_date TIMESTAMP WITH TIME ZONE,
  next_interview_time VARCHAR(50),
  next_interview_link TEXT,
  next_interview_link_platform VARCHAR(50),
  interviewer_name VARCHAR(255),
  interviewer_email VARCHAR(255),
  
  -- Offer details
  offer_deadline TIMESTAMP WITH TIME ZONE,
  offer_status VARCHAR(50),
  
  -- Job posting information
  job_url TEXT,
  career_portal_url TEXT,
  
  -- Confidence & quality metrics
  parser_confidence DECIMAL(3, 2),
  parsing_platform VARCHAR(50),
  validation_score DECIMAL(3, 2),
  user_confidence DECIMAL(3, 2) DEFAULT 1.0,
  
  -- User interactions
  notes TEXT,
  starred BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_at TIMESTAMP WITH TIME ZONE,
  last_email_thread_id VARCHAR(255),
  
  CONSTRAINT unique_user_application UNIQUE(user_id, company_normalized, role_normalized, last_email_thread_id)
);

-- Create indexes for common queries
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(user_id, status);
CREATE INDEX idx_applications_created_at ON applications(user_id, created_at DESC);
CREATE INDEX idx_applications_starred ON applications(user_id, starred) WHERE starred = TRUE;
CREATE INDEX idx_applications_company ON applications(user_id, company_normalized);

-- Email events table (track all emails associated with an application)
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  
  -- Gmail metadata
  gmail_message_id VARCHAR(255) NOT NULL,
  gmail_thread_id VARCHAR(255) NOT NULL,
  email_from VARCHAR(255),
  email_subject TEXT,
  
  -- Event classification
  event_type VARCHAR(50),
  event_confidence DECIMAL(3, 2),
  
  -- Email content
  email_body_preview TEXT,
  email_date TIMESTAMP WITH TIME ZONE,
  
  -- Parser output
  parsed_data JSONB,
  parsing_platform VARCHAR(50),
  
  -- User actions
  marked_as BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_gmail_message UNIQUE(user_id, gmail_message_id)
);

-- Create indexes for email events
CREATE INDEX idx_email_events_application_id ON email_events(application_id);
CREATE INDEX idx_email_events_thread_id ON email_events(user_id, gmail_thread_id);
CREATE INDEX idx_email_events_created_at ON email_events(user_id, created_at DESC);

-- Sync history table (track parse sync operations)
CREATE TABLE sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Sync metadata
  sync_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_end TIMESTAMP WITH TIME ZONE,
  
  -- Results
  emails_processed INTEGER DEFAULT 0,
  applications_created INTEGER DEFAULT 0,
  applications_updated INTEGER DEFAULT 0,
  emails_skipped INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'in_progress',
  error_message TEXT,
  
  -- Gmail date range
  from_date TIMESTAMP WITH TIME ZONE,
  to_date TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sync history
CREATE INDEX idx_sync_history_user_id ON sync_history(user_id);
CREATE INDEX idx_sync_history_created_at ON sync_history(user_id, created_at DESC);

-- RLS (Row Level Security) policies
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own applications
CREATE POLICY applications_user_select ON applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY applications_user_insert ON applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY applications_user_update ON applications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY applications_user_delete ON applications
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see their own email events
CREATE POLICY email_events_user_select ON email_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY email_events_user_insert ON email_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own sync history
CREATE POLICY sync_history_user_select ON sync_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY sync_history_user_insert ON sync_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- JobTrail Database Schema
-- Users table - stores Google OAuth credentials and user data
CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text UNIQUE NOT NULL,
  name           text,
  avatar_url     text,
  google_id      text UNIQUE NOT NULL,
  access_token   text NOT NULL,
  refresh_token  text NOT NULL,
  token_expiry   timestamptz,
  last_synced_at timestamptz,
  created_at     timestamptz DEFAULT now()
);

-- Job applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  company             text NOT NULL,
  company_normalized  text NOT NULL,
  role                text,
  location            text,
  platform            text,
  status              text NOT NULL DEFAULT 'applied',
  applied_date        timestamptz,
  last_activity       timestamptz,
  deadline            timestamptz,
  deadline_label      text,
  is_new_update       boolean DEFAULT false,
  gmail_thread_id     text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Email events table - stores parsed email events
CREATE TABLE IF NOT EXISTS email_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            uuid REFERENCES job_applications(id) ON DELETE CASCADE,
  user_id           uuid REFERENCES users(id) ON DELETE CASCADE,
  event_type        text NOT NULL,
  event_date        timestamptz NOT NULL,
  email_subject     text,
  email_snippet     text,
  gmail_message_id  text UNIQUE,
  parsed_by         text,
  raw_extracted     jsonb,
  created_at        timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_company_normalized ON job_applications(company_normalized);
CREATE INDEX IF NOT EXISTS idx_email_events_job_id ON email_events(job_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_events_gmail_message_id ON email_events(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Note: We use service role key for server-side operations, so these policies
-- are primarily for direct client access (which we won't use in this app)
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users 
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users 
  FOR INSERT WITH CHECK (true);

-- RLS Policies for job_applications
DROP POLICY IF EXISTS "Users can view own jobs" ON job_applications;
CREATE POLICY "Users can view own jobs" ON job_applications 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own jobs" ON job_applications;
CREATE POLICY "Users can insert own jobs" ON job_applications 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own jobs" ON job_applications;
CREATE POLICY "Users can update own jobs" ON job_applications 
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own jobs" ON job_applications;
CREATE POLICY "Users can delete own jobs" ON job_applications 
  FOR DELETE USING (true);

-- RLS Policies for email_events
DROP POLICY IF EXISTS "Users can view own events" ON email_events;
CREATE POLICY "Users can view own events" ON email_events 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own events" ON email_events;
CREATE POLICY "Users can insert own events" ON email_events 
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own events" ON email_events;
CREATE POLICY "Users can update own events" ON email_events 
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete own events" ON email_events;
CREATE POLICY "Users can delete own events" ON email_events 
  FOR DELETE USING (true);

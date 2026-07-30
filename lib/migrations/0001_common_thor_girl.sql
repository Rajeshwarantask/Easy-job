-- Add missing event_type column (should have been in initial migration)
ALTER TABLE "email_events" ADD COLUMN "event_type" text NOT NULL DEFAULT 'update';

-- Drop unused event_date column if it exists
ALTER TABLE "email_events" DROP COLUMN IF EXISTS "event_date";

CREATE TABLE "email_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"gmail_message_id" text NOT NULL,
	"event_type" text NOT NULL,
	"parsed_by" text NOT NULL,
	"confidence" numeric(4, 2),
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company" text NOT NULL,
	"company_normalized" text NOT NULL,
	"role" text,
	"role_normalized" text,
	"location" text,
	"work_mode" text,
	"platform" text,
	"status" text DEFAULT 'applied' NOT NULL,
	"applied_date" timestamp,
	"last_activity" timestamp,
	"deadline" timestamp,
	"deadline_label" text,
	"application_id" text,
	"requisition_id" text,
	"candidate_id" text,
	"interview_date" timestamp,
	"interview_time" text,
	"timezone" text,
	"interview_link" text,
	"assessment_link" text,
	"coding_platform" text,
	"salary" text,
	"job_url" text,
	"career_portal_url" text,
	"recruiter_name" text,
	"recruiter_email" text,
	"confidence" numeric(4, 2) DEFAULT '0',
	"is_new_update" text DEFAULT 'true' NOT NULL,
	"gmail_thread_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"last_synced" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_events_unique" ON "email_events" USING btree ("user_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX "email_events_job_idx" ON "email_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "email_events_user_idx" ON "email_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "jobs_user_company_idx" ON "jobs" USING btree ("user_id","company_normalized");--> statement-breakpoint
CREATE INDEX "jobs_thread_idx" ON "jobs" USING btree ("gmail_thread_id");--> statement-breakpoint
CREATE INDEX "jobs_application_idx" ON "jobs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "jobs_candidate_idx" ON "jobs" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_user_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");

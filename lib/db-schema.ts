import { pgTable, text, timestamp, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";

/**
 * Users table — track sync metadata per user
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // userId from Gmail API
    email: text("email").notNull(),
    lastSynced: timestamp("last_synced"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

/**
 * Jobs table — one row per job application
 * Fields match what findOrCreateJob accepts
 */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),

    userId: text("user_id").notNull(),

    // Core
    company: text("company").notNull(),
    companyNormalized: text("company_normalized").notNull(),

    role: text("role"),
    roleNormalized: text("role_normalized"),

    location: text("location"),

    workMode: text("work_mode"),

    platform: text("platform"),

    status: text("status").notNull().default("applied"),

    appliedDate: timestamp("applied_date"),

    lastActivity: timestamp("last_activity"),

    deadline: timestamp("deadline"),

    deadlineLabel: text("deadline_label"),

    applicationId: text("application_id"),

    requisitionId: text("requisition_id"),

    candidateId: text("candidate_id"),

    interviewDate: timestamp("interview_date"),

    interviewTime: text("interview_time"),

    timezone: text("timezone"),

    interviewLink: text("interview_link"),

    assessmentLink: text("assessment_link"),

    codingPlatform: text("coding_platform"),

    salary: text("salary"),

    jobUrl: text("job_url"),

    careerPortalUrl: text("career_portal_url"),

    recruiterName: text("recruiter_name"),

    recruiterEmail: text("recruiter_email"),

    confidence: numeric("confidence", {
      precision: 4,
      scale: 2,
    }).default("0"),

    isNewUpdate: text("is_new_update")
      .default("true")
      .notNull(),

    gmailThreadId: text("gmail_thread_id"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userCompanyIdx: index("jobs_user_company_idx").on(
      table.userId,
      table.companyNormalized
    ),

    threadIdx: index("jobs_thread_idx").on(
      table.gmailThreadId
    ),

    applicationIdx: index("jobs_application_idx").on(
      table.applicationId
    ),

    candidateIdx: index("jobs_candidate_idx").on(
      table.candidateId
    ),

    statusIdx: index("jobs_status_idx").on(
      table.status
    ),

    userIdx: index("jobs_user_idx").on(
      table.userId
    ),
  })
);

/**
 * Email events table — one row per parsed email
 * Allows tracking parse history and reasoning
 */
export const emailEvents = pgTable(
  "email_events",
  {
    id: text("id").primaryKey(),

    userId: text("user_id").notNull(),

    jobId: text("job_id"),

    gmailMessageId: text("gmail_message_id").notNull(),

    eventType: text("event_type").notNull(),

    parsedBy: text("parsed_by").notNull(),

    confidence: numeric("confidence", {
      precision: 4,
      scale: 2,
    }),

    reasoning: text("reasoning"),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqueEmail: uniqueIndex("email_events_unique")
      .on(table.userId, table.gmailMessageId),

    jobIdx: index("email_events_job_idx")
      .on(table.jobId),

    userIdx: index("email_events_user_idx")
      .on(table.userId),
  })
);

export type User = typeof users.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type EmailEvent = typeof emailEvents.$inferSelect;

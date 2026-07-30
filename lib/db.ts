/**
 * Storage layer using Drizzle ORM + Postgres (Neon).
 *
 * NOTE: All functions maintain the same signatures as the in-memory version
 * so existing callers don't need to change. The only difference is that data
 * now persists to Postgres, which enables real deduplication and state tracking.
 *
 * Key features:
 * - UNIQUE(user_id, gmail_message_id) on email_events prevents duplicate processing
 * - All queries are parameterized for SQL injection safety
 * - Drizzle handles connection pooling automatically via @vercel/postgres
 */

import type {
  JobApplication,
  EmailEvent,
  JobStatus,
  JobWithEvents,
} from "./types";
import { randomUUID } from "crypto";
import { normalizeCompanyName, companyKey, normalizeRole, EVENT_STAGE_RANK, eventTypeToStatus } from "./normalize";
import { db } from "./db-client";
import { jobs, emailEvents, users } from "./db-schema";
import { eq, and, desc, inArray } from "drizzle-orm";

// ─── User meta ────────────────────────────────────────────────────────────────

export async function getUser(userId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user
      ? {
          lastSyncedAt: user.lastSynced?.toISOString() ?? undefined,
        }
      : null;
  } catch (err) {
    console.error(`[db] getUser failed for ${userId}:`, err);
    return null;
  }
}

export async function updateUserLastSynced(userId: string) {
  try {
    await db
      .insert(users)
      .values({
        id: userId,
        lastSynced: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { lastSynced: new Date() },
      });
  } catch (err) {
    console.error(`[db] updateUserLastSynced failed for ${userId}:`, err);
  }
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function getJobApplications(userId: string): Promise<JobApplication[]> {
  try {
    const result = await db.query.jobs.findMany({
      where: eq(jobs.userId, userId),
      orderBy: [desc(jobs.createdAt)],
    });
    return result as JobApplication[];
  } catch (err) {
    console.error(`[db] getJobApplications failed for ${userId}:`, err);
    return [];
  }
}

export async function getJobApplication(
  jobId: string,
  userId: string,
): Promise<JobWithEvents | null> {
  try {
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
      with: {
        events: {
          orderBy: desc(emailEvents.createdAt),
        },
      },
    });

    if (!job) return null;

    return {
      ...(job as JobApplication),
      email_events: (job.events as EmailEvent[]) ?? [],
    };
  } catch (err) {
    console.error(`[db] getJobApplication failed for ${jobId}:`, err);
    return null;
  }
}

function newJobDefaults(): Omit<JobApplication, "id" | "user_id" | "company" | "company_normalized" | "created_at" | "updated_at"> {
  return {
    role: null,
    role_normalized: null,
    location: null,
    work_mode: null,
    platform: null,
    status: "applied",
    applied_date: null,
    last_activity: null,
    deadline: null,
    deadline_label: null,
    application_id: null,
    requisition_id: null,
    candidate_id: null,
    interview_date: null,
    interview_time: null,
    timezone: null,
    interview_link: null,
    assessment_link: null,
    coding_platform: null,
    salary: null,
    job_url: null,
    career_portal_url: null,
    recruiter_name: null,
    recruiter_email: null,
    confidence: 0,
    is_new_update: true,
    gmail_thread_id: null,
  };
}

export async function createJobApplication(
  job: Omit<JobApplication, "id" | "created_at" | "updated_at">,
): Promise<JobApplication> {
  try {
    const now = new Date();
    const newJob: JobApplication = {
      ...job,
      id: randomUUID(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await db.insert(jobs).values({
      id: newJob.id,
      userId: job.user_id,
      company: job.company,
      companyNormalized: job.company_normalized,
      role: job.role,
      roleNormalized: job.role_normalized,
      location: job.location,
      workMode: job.work_mode,
      platform: job.platform,
      status: job.status,
      appliedDate: job.applied_date ? new Date(job.applied_date) : null,
      lastActivity: job.last_activity ? new Date(job.last_activity) : null,
      deadline: job.deadline ? new Date(job.deadline) : null,
      deadlineLabel: job.deadline_label,
      applicationId: job.application_id,
      requisitionId: job.requisition_id,
      candidateId: job.candidate_id,
      interviewDate: job.interview_date ? new Date(job.interview_date) : null,
      interviewTime: job.interview_time,
      timezone: job.timezone,
      interviewLink: job.interview_link,
      assessmentLink: job.assessment_link,
      codingPlatform: job.coding_platform,
      salary: job.salary,
      jobUrl: job.job_url,
      careerPortalUrl: job.career_portal_url,
      recruiterName: job.recruiter_name,
      recruiterEmail: job.recruiter_email,
      confidence: job.confidence,
      isNewUpdate: job.is_new_update,
      gmailThreadId: job.gmail_thread_id,
      createdAt: now,
      updatedAt: now,
    });
    return newJob;
  } catch (err) {
    console.error("[db] createJobApplication failed:", err);
    throw err;
  }
}

export async function updateJobApplication(
  jobId: string,
  userId: string,
  updates: Partial<JobApplication>,
): Promise<JobApplication | null> {
  try {
    const existing = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)),
    });

    if (!existing) return null;

    const now = new Date();
    const updateData: Record<string, any> = {
      updatedAt: now,
    };

    // Map incoming fields to database column names
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.role_normalized !== undefined) updateData.roleNormalized = updates.role_normalized;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.work_mode !== undefined) updateData.workMode = updates.work_mode;
    if (updates.platform !== undefined) updateData.platform = updates.platform;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.applied_date !== undefined) updateData.appliedDate = updates.applied_date ? new Date(updates.applied_date) : null;
    if (updates.last_activity !== undefined) updateData.lastActivity = updates.last_activity ? new Date(updates.last_activity) : null;
    if (updates.deadline !== undefined) updateData.deadline = updates.deadline ? new Date(updates.deadline) : null;
    if (updates.deadline_label !== undefined) updateData.deadlineLabel = updates.deadline_label;
    if (updates.application_id !== undefined) updateData.applicationId = updates.application_id;
    if (updates.requisition_id !== undefined) updateData.requisitionId = updates.requisition_id;
    if (updates.candidate_id !== undefined) updateData.candidateId = updates.candidate_id;
    if (updates.interview_date !== undefined) updateData.interviewDate = updates.interview_date ? new Date(updates.interview_date) : null;
    if (updates.interview_time !== undefined) updateData.interviewTime = updates.interview_time;
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone;
    if (updates.interview_link !== undefined) updateData.interviewLink = updates.interview_link;
    if (updates.assessment_link !== undefined) updateData.assessmentLink = updates.assessment_link;
    if (updates.coding_platform !== undefined) updateData.codingPlatform = updates.coding_platform;
    if (updates.salary !== undefined) updateData.salary = updates.salary;
    if (updates.job_url !== undefined) updateData.jobUrl = updates.job_url;
    if (updates.career_portal_url !== undefined) updateData.careerPortalUrl = updates.career_portal_url;
    if (updates.recruiter_name !== undefined) updateData.recruiterName = updates.recruiter_name;
    if (updates.recruiter_email !== undefined) updateData.recruiterEmail = updates.recruiter_email;
    if (updates.confidence !== undefined) updateData.confidence = updates.confidence;
    if (updates.is_new_update !== undefined) updateData.isNewUpdate = updates.is_new_update;
    if (updates.gmail_thread_id !== undefined) updateData.gmailThreadId = updates.gmail_thread_id;

    await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));

    return {
      ...(existing as JobApplication),
      ...updates,
      updated_at: now.toISOString(),
    };
  } catch (err) {
    console.error(`[db] updateJobApplication failed for ${jobId}:`, err);
    return null;
  }
}

export async function updateJobStatus(
  jobId: string,
  userId: string,
  status: JobStatus,
): Promise<JobApplication | null> {
  return updateJobApplication(jobId, userId, { status });
}

export async function deleteJobApplication(jobId: string, userId: string): Promise<boolean> {
  try {
    const result = await db.delete(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
    return result.count > 0;
  } catch (err) {
    console.error(`[db] deleteJobApplication failed for ${jobId}:`, err);
    return false;
  }
}

export async function markJobAsRead(jobId: string, userId: string): Promise<void> {
  await updateJobApplication(jobId, userId, { is_new_update: false });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export async function getEmailEvents(jobId: string): Promise<EmailEvent[]> {
  try {
    const result = await db.query.emailEvents.findMany({
      where: eq(emailEvents.jobId, jobId),
      orderBy: desc(emailEvents.createdAt),
    });
    return result as EmailEvent[];
  } catch (err) {
    console.error(`[db] getEmailEvents failed for ${jobId}:`, err);
    return [];
  }
}

export async function createEmailEvent(
  event: Omit<EmailEvent, "id" | "created_at">,
): Promise<EmailEvent | null> {
  try {
    const now = new Date();
    const newEvent: EmailEvent = {
      ...event,
      id: randomUUID(),
      created_at: now.toISOString(),
    };

    await db.insert(emailEvents).values({
      id: newEvent.id,
      userId: event.user_id,
      jobId: event.job_id,
      gmailMessageId: event.gmail_message_id,
      eventType: event.event_type,
      parsedBy: event.parsed_by,
      confidence: event.confidence,
      reasoning: event.reasoning,
      createdAt: now,
    });

    return newEvent;
  } catch (err: any) {
    // Handle unique constraint violation (duplicate gmail_message_id)
    if (err?.code === "23505") {
      // Unique constraint violation — this is expected on retries
      return null;
    }
    console.error("[db] createEmailEvent failed:", err);
    throw err;
  }
}

export async function getExistingMessageIds(userId: string): Promise<Set<string>> {
  try {
    const result = await db.query.emailEvents.findMany({
      where: eq(emailEvents.userId, userId),
    });
    return new Set(result.map((e) => e.gmailMessageId).filter(Boolean));
  } catch (err) {
    console.error(`[db] getExistingMessageIds failed for ${userId}:`, err);
    return new Set();
  }
}

// ─── Find or create job ───────────────────────────────────────────────────────

export interface JobUpsertData {
  role?: string | null;
  status?: JobStatus;
  location?: string | null;
  work_mode?: JobApplication["work_mode"];
  platform?: string | null;
  confidence?: number;
  appliedDate: string;
  lastActivity?: string;
  deadline?: string | null;
  deadlineLabel?: string | null;
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
  gmailThreadId?: string | null;
}

function coalesce<T>(existing: T | null | undefined, incoming: T | null | undefined): T | null {
  return (existing ?? null) !== null ? (existing as T) : (incoming ?? null);
}

export async function findOrCreateJob(
  userId: string,
  company: string,
  data: JobUpsertData,
): Promise<JobApplication> {
  const normalizedCompany = companyKey(company);
  const normalizedRole = normalizeRole(data.role);
  const jobList = await getJobApplications(userId);

  const existing =
    (data.gmailThreadId && jobList.find((j) => j.gmail_thread_id && j.gmail_thread_id === data.gmailThreadId)) ||
    (data.application_id && jobList.find((j) => j.application_id === data.application_id)) ||
    (data.candidate_id && jobList.find((j) => j.candidate_id === data.candidate_id)) ||
    jobList.find(
      (j) =>
        j.company_normalized === normalizedCompany &&
        (normalizedRole === null || j.role_normalized === null || j.role_normalized === normalizedRole),
    );

  const incomingStatus = data.status ?? "applied";

  if (existing) {
    const currentRank = EVENT_STAGE_RANK[statusToEventType(existing.status)] ?? 0;
    const incomingRank = EVENT_STAGE_RANK[statusToEventType(incomingStatus)] ?? 0;
    const nextStatus = incomingRank > currentRank ? incomingStatus : existing.status;

    const isNewer =
      !existing.last_activity || new Date(data.appliedDate) > new Date(existing.last_activity);

    const updated = await updateJobApplication(existing.id, userId, {
      status: nextStatus,
      last_activity: isNewer ? (data.lastActivity ?? data.appliedDate) : existing.last_activity,
      is_new_update: isNewer ? true : existing.is_new_update,
      role: coalesce(existing.role, data.role),
      role_normalized: coalesce(existing.role_normalized, normalizedRole),
      location: coalesce(existing.location, data.location),
      work_mode: coalesce(existing.work_mode, data.work_mode),
      platform: coalesce(existing.platform, data.platform),
      deadline: coalesce(existing.deadline, data.deadline),
      deadline_label: coalesce(existing.deadline_label, data.deadlineLabel),
      application_id: coalesce(existing.application_id, data.application_id),
      requisition_id: coalesce(existing.requisition_id, data.requisition_id),
      candidate_id: coalesce(existing.candidate_id, data.candidate_id),
      interview_date: coalesce(existing.interview_date, data.interview_date),
      interview_time: coalesce(existing.interview_time, data.interview_time),
      timezone: coalesce(existing.timezone, data.timezone),
      interview_link: coalesce(existing.interview_link, data.interview_link),
      assessment_link: coalesce(existing.assessment_link, data.assessment_link),
      coding_platform: coalesce(existing.coding_platform, data.coding_platform),
      salary: coalesce(existing.salary, data.salary),
      job_url: coalesce(existing.job_url, data.job_url),
      career_portal_url: coalesce(existing.career_portal_url, data.career_portal_url),
      recruiter_name: coalesce(existing.recruiter_name, data.recruiter_name),
      recruiter_email: coalesce(existing.recruiter_email, data.recruiter_email),
      confidence: Math.max(existing.confidence ?? 0, data.confidence ?? 0),
      gmail_thread_id: coalesce(existing.gmail_thread_id, data.gmailThreadId),
    });
    return updated ?? existing;
  }

  return createJobApplication({
    ...newJobDefaults(),
    user_id: userId,
    company,
    company_normalized: normalizedCompany,
    role: data.role ?? null,
    role_normalized: normalizedRole,
    location: data.location ?? null,
    work_mode: data.work_mode ?? null,
    platform: data.platform ?? null,
    status: incomingStatus,
    applied_date: data.appliedDate,
    last_activity: data.lastActivity ?? data.appliedDate,
    deadline: data.deadline ?? null,
    deadline_label: data.deadlineLabel ?? null,
    application_id: data.application_id ?? null,
    requisition_id: data.requisition_id ?? null,
    candidate_id: data.candidate_id ?? null,
    interview_date: data.interview_date ?? null,
    interview_time: data.interview_time ?? null,
    timezone: data.timezone ?? null,
    interview_link: data.interview_link ?? null,
    assessment_link: data.assessment_link ?? null,
    coding_platform: data.coding_platform ?? null,
    salary: data.salary ?? null,
    job_url: data.job_url ?? null,
    career_portal_url: data.career_portal_url ?? null,
    recruiter_name: data.recruiter_name ?? null,
    recruiter_email: data.recruiter_email ?? null,
    confidence: data.confidence ?? 0,
    gmail_thread_id: data.gmailThreadId ?? null,
  });
}

function statusToEventType(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    applied: "applied",
    interview: "interview",
    offer: "offer",
    rejected: "rejected",
    withdrawn: "withdrawn",
  };
  return map[status] ?? "applied";
}

// ─── Clear all data for a user (called on sign-out) ──────────────────────────

export async function clearUserData(userId: string): Promise<void> {
  try {
    await db.delete(jobs).where(eq(jobs.userId, userId));
    await db.delete(emailEvents).where(eq(emailEvents.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  } catch (err) {
    console.error(`[db] clearUserData failed for ${userId}:`, err);
  }
}

// ─── Re-exports for backward compatibility ──────────────────────────────────

export { normalizeCompanyName } from "./normalize";

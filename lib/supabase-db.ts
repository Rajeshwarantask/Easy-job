import { createClient } from "@/lib/supabase/server";

export interface Job {
  id: string;
  user_id: string;
  company: string;
  role?: string;
  status: string;
  platform?: string;
  job_url?: string;
  recruiter_name?: string;
  recruiter_email?: string;
  confidence: number;
  gmail_thread_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailEvent {
  id: string;
  user_id: string;
  job_id?: string;
  gmail_message_id?: string;
  email_subject?: string;
  event_type: string;
  confidence: number;
  reasoning?: string;
  created_at: string;
}

// Get all jobs for a user
export async function getJobApplications(userId: string): Promise<Job[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[db] getJobApplications error:", error);
    return [];
  }

  return data as Job[];
}

// Get single job
export async function getJobApplication(userId: string, jobId: string): Promise<Job | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", jobId)
    .single();

  if (error) {
    console.error("[db] getJobApplication error:", error);
    return null;
  }

  return data as Job;
}

// Create a new job
export async function createJob(
  userId: string,
  job: Omit<Job, "id" | "user_id" | "created_at" | "updated_at">
): Promise<Job | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      ...job,
    })
    .select()
    .single();

  if (error) {
    console.error("[db] createJob error:", error);
    return null;
  }

  return data as Job;
}

// Find or create a job
export async function findOrCreateJob(
  userId: string,
  job: { company: string; role?: string; status: string }
): Promise<Job | null> {
  const supabase = await createClient();

  // Try to find existing job
  const { data: existing, error: findError } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("company", job.company)
    .eq("role", job.role || null)
    .limit(1);

  if (findError) {
    console.error("[db] findOrCreateJob find error:", findError);
  }

  if (existing && existing.length > 0) {
    return existing[0] as Job;
  }

  // Create new job
  return createJob(userId, {
    company: job.company,
    role: job.role,
    status: job.status,
    confidence: 0.8,
  });
}

// Update a job
export async function updateJobApplication(
  userId: string,
  jobId: string,
  updates: Partial<Job>
): Promise<Job | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", jobId)
    .select()
    .single();

  if (error) {
    console.error("[db] updateJobApplication error:", error);
    return null;
  }

  return data as Job;
}

// Delete a job
export async function deleteJobApplication(userId: string, jobId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("user_id", userId)
    .eq("id", jobId);

  if (error) {
    console.error("[db] deleteJobApplication error:", error);
    return false;
  }

  return true;
}

// Create an email event
export async function createEmailEvent(
  userId: string,
  jobId: string,
  event: Omit<EmailEvent, "id" | "user_id" | "created_at">
): Promise<EmailEvent | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("email_events")
    .insert({
      user_id: userId,
      job_id: jobId,
      ...event,
    })
    .select()
    .single();

  if (error) {
    console.error("[db] createEmailEvent error:", error);
    return null;
  }

  return data as EmailEvent;
}

// Get email events for a job
export async function getEmailEvents(userId: string, jobId: string): Promise<EmailEvent[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("email_events")
    .select("*")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[db] getEmailEvents error:", error);
    return [];
  }

  return data as EmailEvent[];
}

// Mark job as read (update is_new_update)
export async function markJobAsRead(userId: string, jobId: string): Promise<boolean> {
  return updateJobApplication(userId, jobId, { isNewUpdate: "false" }) !== null;
}

// Clear all user data
export async function clearUserData(userId: string): Promise<boolean> {
  const supabase = await createClient();
  
  // Delete jobs (cascade will delete email_events)
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[db] clearUserData error:", error);
    return false;
  }

  return true;
}

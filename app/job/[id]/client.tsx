"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { useSyncJobs } from "@/hooks/use-sync-jobs";
import { JobDetailHeader } from "@/components/job/job-detail-header";
import { JobTimeline } from "@/components/job/job-timeline";
import { JobActions } from "@/components/job/job-actions";
import type { JobWithEvents } from "@/lib/types";

export function JobDetailPageClient() {
  const params = useParams();
  const jobId = params.id as string;
  
  const { jobs } = useSyncJobs();
  const [job, setJob] = useState<JobWithEvents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFoundError, setNotFoundError] = useState(false);

  useEffect(() => {
    if (!jobId || !jobs.length) {
      if (jobs.length > 0) {
        setLoading(false);
        setNotFoundError(true);
      }
      return;
    }

    // Find job from synced data
    const found = jobs.find((j) => j.id === jobId);
    if (found) {
      // Fetch full job details including events
      fetch(`/api/jobs/${jobId}`)
        .then((res) => {
          if (res.status === 404) {
            setNotFoundError(true);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) {
            setJob(data);
            setError(null);
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || "Failed to load job");
          setLoading(false);
        });
    } else if (jobs.length > 0) {
      setNotFoundError(true);
      setLoading(false);
    }
  }, [jobId, jobs]);

  if (notFoundError) {
    notFound();
  }

  if (loading) {
    return (
      <div className="py-6 px-4 lg:px-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-muted-foreground">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="py-6 px-4 lg:px-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-destructive">Error: {error || "Job not found"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 px-4 lg:px-6 max-w-4xl mx-auto space-y-8">
      <JobDetailHeader job={job} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <JobTimeline
            events={job.email_events || []}
            status={job.status}
            appliedDate={job.applied_date}
          />
        </div>

        <div>
          <JobActions job={job} />
        </div>
      </div>
    </div>
  );
}

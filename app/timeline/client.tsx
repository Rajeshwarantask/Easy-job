"use client";

import { useSyncJobs } from "@/hooks/use-sync-jobs";
import { AllJobsTimeline } from "@/components/timeline/all-jobs-timeline";

export function TimelinePageClient() {
  const { jobs, status } = useSyncJobs();

  // Only block render with a spinner when there are genuinely no jobs AND
  // the very first sync is in progress. If we already have cached jobs,
  // show them immediately — the background sync will update silently.
  const showSpinner = status === "syncing" && jobs.length === 0;

  if (showSpinner) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">Syncing your applications…</span>
        </div>
      </div>
    );
  }

  return <AllJobsTimeline jobs={jobs} />;
}

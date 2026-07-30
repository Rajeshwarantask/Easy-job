"use client";

import { JobCard } from "./job-card";
import type { JobApplication, JobStatus } from "@/lib/types";

interface KanbanColumnProps {
  id: JobStatus;
  title: string;
  jobs: JobApplication[];
}

const STATUS_COLORS: Record<JobStatus, string> = {
  applied: "bg-status-applied",
  interview: "bg-status-interview",
  offer: "bg-status-offer",
  rejected: "bg-status-rejected",
  withdrawn: "bg-status-withdrawn",
};

export function KanbanColumn({ id, title, jobs }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[id]}`} />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {jobs.length}
        </span>
      </div>

      <div className="flex-1 rounded-lg border border-border p-2 min-h-[calc(100vh-200px)] bg-card/50">
        <div className="space-y-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              No jobs yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

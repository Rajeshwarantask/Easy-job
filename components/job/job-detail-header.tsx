"use client";

import Link from "next/link";
import { ArrowLeft, Building2, MapPin, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JobWithEvents, JobStatus } from "@/lib/types";
import { format } from "date-fns";

interface JobDetailHeaderProps {
  job: JobWithEvents;
}

const STATUS_STYLES: Record<JobStatus, { label: string; className: string }> = {
  applied: { label: "Applied", className: "bg-status-applied/20 text-[oklch(0.85_0.15_250)] border-status-applied/30" },
  interview: { label: "Interview", className: "bg-status-interview/20 text-[oklch(0.9_0.15_85)] border-status-interview/30" },
  offer: { label: "Offer", className: "bg-status-offer/20 text-[oklch(0.85_0.15_145)] border-status-offer/30" },
  rejected: { label: "Rejected", className: "bg-status-rejected/20 text-[oklch(0.8_0.15_25)] border-status-rejected/30" },
  withdrawn: { label: "Withdrawn", className: "bg-muted text-muted-foreground border-border" },
};

export function JobDetailHeader({ job }: JobDetailHeaderProps) {
  const status = STATUS_STYLES[job.status];

  return (
    <div className="space-y-4">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-secondary shrink-0">
          <Building2 className="w-7 h-7 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">
              {job.company}
            </h1>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </div>

          {job.role && (
            <p className="text-lg text-muted-foreground">{job.role}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            )}
            {job.applied_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Applied {format(new Date(job.applied_date), "MMM d, yyyy")}
              </span>
            )}
            {job.platform && (
              <span className="flex items-center gap-1.5">
                <ExternalLink className="w-4 h-4" />
                {job.platform}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

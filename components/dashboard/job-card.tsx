"use client";

import Link from "next/link";
import { Building2, MapPin, Calendar, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { JobApplication } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  job: JobApplication;
}

export function JobCard({ job }: JobCardProps) {
  const formattedDate = job.last_activity
    ? formatDistanceToNow(new Date(job.last_activity), { addSuffix: true })
    : job.applied_date
    ? formatDistanceToNow(new Date(job.applied_date), { addSuffix: true })
    : null;

  return (
    <div>
      <Link href={`/job/${job.id}`}>
        <Card
          className={`p-3 hover:bg-accent/50 transition-colors ${
            job.is_new_update ? "ring-1 ring-primary/50" : ""
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary shrink-0">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-medium text-sm text-foreground truncate">
                    {job.company}
                  </h4>
                  {job.role && (
                    <p className="text-xs text-muted-foreground truncate">
                      {job.role}
                    </p>
                  )}
                </div>
              </div>
              {job.is_new_update && (
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {job.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{job.location}</span>
                </span>
              )}
              {formattedDate && (
                <span className="flex items-center gap-1 shrink-0">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              )}
            </div>

            {job.platform && (
              <div className="pt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-muted-foreground">
                  {job.platform}
                </span>
              </div>
            )}
          </div>
        </Card>
      </Link>
    </div>
  );
}

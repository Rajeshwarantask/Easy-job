"use client";

import Link from "next/link";
import { Building2, MapPin, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JobApplication } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface RecentJobsListProps {
  jobs: JobApplication[];
  isDemo?: boolean;
}

export function RecentJobsList({ jobs, isDemo = false }: RecentJobsListProps) {
  const router = useRouter();
  // Sort by last_activity descending, take top 5
  const recent = [...jobs]
    .sort((a, b) => {
      const aDate = a.last_activity || a.created_at;
      const bDate = b.last_activity || b.created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    })
    .slice(0, 5);

  const timelineHref = isDemo ? "/timeline?demo=true" : "/timeline";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
        <Link href={timelineHref}>
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            View all
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {recent.map((job) => {
          const statusCfg = STATUS_CONFIG[job.status];
          const date = job.last_activity || job.applied_date;
          return (
            <Card
              key={job.id}
              className="px-4 py-3 cursor-pointer hover:bg-accent/40 transition-colors light:glass light:shadow-sm"
              onClick={() => router.push(timelineHref)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-secondary shrink-0">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground truncate">
                      {job.company}
                    </span>
                    {job.is_new_update && (
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {job.role && <span className="truncate">{job.role}</span>}
                    {job.location && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />
                          {job.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      statusCfg.bgColor,
                      statusCfg.color
                    )}
                  >
                    {statusCfg.label}
                  </span>
                  {date && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDistanceToNow(new Date(date), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {jobs.length > 5 && (
        <Link href={timelineHref}>
          <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
            See all {jobs.length} applications
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

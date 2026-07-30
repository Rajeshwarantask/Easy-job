"use client";

import { Check, Circle } from "lucide-react";
import type { JobStatus } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const STAGES: { id: JobStatus | "screening"; label: string; description: string }[] = [
  { id: "applied",    label: "Applied",    description: "Application submitted" },
  { id: "screening",  label: "Screening",  description: "Resume / phone screen" },
  { id: "interview",  label: "Interview",  description: "Interview rounds" },
  { id: "offer",      label: "Offer",      description: "Offer extended" },
];

// Map a job status to how far along the stage track we are
function getStageIndex(status: JobStatus): number {
  switch (status) {
    case "applied":    return 0;
    case "interview":  return 2;
    case "offer":      return 3;
    case "rejected":   return -1; // terminal — show special state
    case "withdrawn":  return -1;
    default:           return 0;
  }
}

interface StageProgressProps {
  status: JobStatus;
  appliedDate?: string | null;
}

export function StageProgress({ status, appliedDate }: StageProgressProps) {
  const isTerminal = status === "rejected" || status === "withdrawn";
  const currentIndex = getStageIndex(status);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Application Stage
        </span>
        {appliedDate && (
          <span className="text-xs text-muted-foreground">
            Started {formatDistanceToNow(new Date(appliedDate), { addSuffix: true })}
          </span>
        )}
      </div>

      {isTerminal ? (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
          status === "rejected"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
        )}>
          <Circle className="w-4 h-4" />
          {status === "rejected" ? "Application rejected" : "Withdrawn from process"}
        </div>
      ) : (
        <div className="flex items-center gap-0">
          {STAGES.map((stage, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent   = index === currentIndex;
            const isUpcoming  = index > currentIndex;

            return (
              <div key={stage.id} className="flex items-center flex-1 last:flex-none">
                {/* Node */}
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full border-2 transition-colors",
                    isCompleted && "bg-primary border-primary",
                    isCurrent  && "bg-background border-primary",
                    isUpcoming && "bg-background border-border"
                  )}>
                    {isCompleted && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    {isCurrent  && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    {isUpcoming && <div className="w-2.5 h-2.5 rounded-full bg-border" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium whitespace-nowrap",
                    isCompleted && "text-primary",
                    isCurrent  && "text-foreground",
                    isUpcoming && "text-muted-foreground"
                  )}>
                    {stage.label}
                  </span>
                </div>

                {/* Connector line (skip after last) */}
                {index < STAGES.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors",
                    index < currentIndex ? "bg-primary" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

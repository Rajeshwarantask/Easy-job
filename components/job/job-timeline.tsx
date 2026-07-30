"use client";

import { Mail, Send, MessageSquare, Award, XCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageProgress } from "@/components/timeline/stage-progress";
import type { EmailEvent, JobStatus } from "@/lib/types";
import { format, formatDistanceToNow } from "date-fns";

interface JobTimelineProps {
  events: EmailEvent[];
  status: JobStatus;
  appliedDate?: string | null;
}

const EVENT_ICONS: Record<string, typeof Mail> = {
  applied: Send,
  interview: MessageSquare,
  offer: Award,
  rejected: XCircle,
  update: Mail,
};

const EVENT_COLORS: Record<string, string> = {
  applied: "bg-status-applied text-white",
  interview: "bg-status-interview text-white",
  offer: "bg-status-offer text-white",
  rejected: "bg-status-rejected text-white",
  update: "bg-muted text-muted-foreground",
};

const EVENT_LABELS: Record<string, string> = {
  applied: "Application Submitted",
  interview: "Interview Scheduled",
  offer: "Offer Received",
  rejected: "Application Rejected",
  update: "Update",
};

export function JobTimeline({ events, status, appliedDate }: JobTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-5 pb-5">
            <StageProgress status={status} appliedDate={appliedDate} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No activity yet</p>
              <p className="text-sm text-muted-foreground">
                Sync your Gmail to see email activity
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5 pb-5">
          <StageProgress status={status} appliedDate={appliedDate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
        </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

          {events.map((event, index) => {
            const Icon = EVENT_ICONS[event.event_type] || Mail;
            const colorClass = EVENT_COLORS[event.event_type] || EVENT_COLORS.update;
            const label = EVENT_LABELS[event.event_type] || "Update";

            return (
              <div key={event.id} className="relative pl-10 pb-8 last:pb-0">
                {/* Icon */}
                <div
                  className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full ${colorClass}`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.event_date), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.event_date), "MMM d, yyyy 'at' h:mm a")}
                  </p>

                  {event.email_subject && (
                    <div className="mt-2 p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {event.email_subject}
                      </p>
                      {event.email_snippet && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {event.email_snippet}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Connector for next event */}
                {index < events.length - 1 && (
                  <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      </Card>
    </div>
  );
}

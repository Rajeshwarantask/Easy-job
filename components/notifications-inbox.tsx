"use client";

import { useMemo, useState } from "react";
import { Bell, Building2, Award, MessageSquare, XCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSyncJobs } from "@/hooks/use-sync-jobs";
import { STATUS_CONFIG } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_ICONS = {
  applied: CheckCircle,
  interview: MessageSquare,
  offer: Award,
  rejected: XCircle,
  withdrawn: Clock,
};

const STATUS_COLORS = {
  applied: "text-blue-500",
  interview: "text-amber-500",
  offer: "text-green-500",
  rejected: "text-red-500",
  withdrawn: "text-muted-foreground",
};

export function NotificationsInbox() {
  const { jobs } = useSyncJobs();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Build notifications from jobs with recent activity
  const notifications = useMemo(() => {
    return jobs
      .filter((j) => j.is_new_update && !dismissed.has(j.id))
      .sort((a, b) => {
        const aDate = a.last_activity || a.updated_at;
        const bDate = b.last_activity || b.updated_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 10);
  }, [jobs, dismissed]);

  const unreadCount = notifications.length;

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissed(new Set(jobs.map((j) => j.id)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount === 0 ? "All caught up" : `${unreadCount} new update${unreadCount > 1 ? "s" : ""}`}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={dismissAll}
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No new notifications</p>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                New status changes will appear here
              </p>
            </div>
          ) : (
            notifications.map((job) => {
              const cfg = STATUS_CONFIG[job.status];
              const Icon = STATUS_ICONS[job.status];
              const iconColor = STATUS_COLORS[job.status];
              const date = job.last_activity || job.updated_at;
              return (
                <div
                  key={job.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-accent/50 transition-colors group"
                >
                  <div className={cn("mt-0.5 shrink-0", iconColor)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {job.company}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job.role ? `${job.role} · ` : ""}
                      <span className={cn("font-medium", iconColor)}>{cfg.label}</span>
                    </p>
                    {date && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {formatDistanceToNow(new Date(date), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => dismiss(job.id)}
                    aria-label="Dismiss"
                  >
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

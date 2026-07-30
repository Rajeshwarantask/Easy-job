"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  addMonths, subMonths, format, isPast, isFuture,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSyncJobs } from "@/hooks/use-sync-jobs";
import { STATUS_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  date: Date;
  label: string;
  company: string;
  role: string | null;
  type: "deadline" | "applied" | "interview";
  status: string;
}

export function CalendarClient() {
  const { jobs } = useSyncJobs();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Build events from jobs
  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = [];
    jobs.forEach((job) => {
      if (job.deadline) {
        list.push({
          date: new Date(job.deadline),
          label: job.deadline_label ?? "Deadline",
          company: job.company,
          role: job.role,
          type: "deadline",
          status: job.status,
        });
      }
      if (job.applied_date) {
        list.push({
          date: new Date(job.applied_date),
          label: "Applied",
          company: job.company,
          role: job.role,
          type: "applied",
          status: job.status,
        });
      }
      if (job.status === "interview" && job.last_activity) {
        list.push({
          date: new Date(job.last_activity),
          label: "Interview",
          company: job.company,
          role: job.role,
          type: "interview",
          status: "interview",
        });
      }
    });
    return list;
  }, [jobs]);

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(e.date, day));

  // Upcoming events (next 30 days)
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => isFuture(e.date) || isToday(e.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 8);
  }, [events]);

  const EVENT_COLORS = {
    deadline: "bg-red-500/15 text-red-600 border-red-500/30",
    interview: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    applied: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  const EVENT_DOTS = {
    deadline: "bg-red-500",
    interview: "bg-amber-500",
    applied: "bg-blue-500",
  };

  return (
    <div className="py-6 px-4 lg:px-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Deadlines, interviews and application dates</p>
        </div>
        {/* Legend */}
        <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
          {(["deadline", "interview", "applied"] as const).map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", EVENT_DOTS[type])} />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Calendar grid */}
        <Card className="p-4 light:glass light:shadow-sm">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[64px] p-1 bg-background",
                    !inMonth && "opacity-40",
                    today && "bg-accent/50"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs mb-1",
                      today
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev, i) => (
                      <div
                        key={i}
                        className={cn(
                          "text-[10px] px-1 py-0.5 rounded border truncate leading-tight",
                          EVENT_COLORS[ev.type]
                        )}
                        title={`${ev.company} — ${ev.label}`}
                      >
                        {ev.company}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayEvents.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Upcoming sidebar */}
        <div className="space-y-3">
          <Card className="p-4 light:glass light:shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Upcoming</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((ev, i) => {
                  const daysAway = Math.ceil(
                    (ev.date.getTime() - Date.now()) / 86400000
                  );
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          EVENT_DOTS[ev.type]
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {ev.company}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ev.label}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-xs shrink-0 font-medium tabular-nums",
                          daysAway <= 3 ? "text-red-500" : "text-muted-foreground"
                        )}
                      >
                        {daysAway === 0 ? "Today" : `${daysAway}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Overdue / missed deadlines */}
          {(() => {
            const overdue = events.filter((e) => e.type === "deadline" && isPast(e.date));
            if (overdue.length === 0) return null;
            return (
              <Card className="p-4 border-destructive/30 light:glass light:shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <h3 className="text-sm font-semibold text-destructive">Past deadlines</h3>
                </div>
                <div className="space-y-2">
                  {overdue.slice(0, 4).map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-destructive" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{ev.company}</p>
                        <p className="text-xs text-muted-foreground">{format(ev.date, "MMM d")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

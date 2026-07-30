"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Building2, MapPin, ChevronDown, ChevronRight, ArrowLeft,
  Sparkles, Search, X, Mail, Calendar, ExternalLink,
  Clock, CheckCircle2, XCircle, AlertCircle, Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StageProgress } from "@/components/timeline/stage-progress";
import type { JobApplication, EmailEvent, JobWithEvents } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface AllJobsTimelineProps {
  jobs: JobApplication[];
  isDemo?: boolean;
}

const ALL_STATUSES = ["applied", "interview", "offer", "rejected", "withdrawn"] as const;

// Map event_type string to an icon + colour
function eventMeta(type: string): { icon: React.ElementType; color: string; label: string } {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("offer"))      return { icon: CheckCircle2, color: "text-green-500",  label: "Offer" };
  if (t.includes("reject"))     return { icon: XCircle,      color: "text-red-500",    label: "Rejection" };
  if (t.includes("interview"))  return { icon: Briefcase,    color: "text-amber-500",  label: "Interview" };
  if (t.includes("screen"))     return { icon: AlertCircle,  color: "text-blue-400",   label: "Screening" };
  if (t.includes("applied"))    return { icon: CheckCircle2, color: "text-primary",    label: "Applied" };
  return                               { icon: Mail,          color: "text-muted-foreground", label: type ?? "Email" };
}

// Fetch + cache expanded job details so we don't re-fetch on re-expand
const detailCache: Record<string, JobWithEvents> = {};

export function AllJobsTimeline({ jobs, isDemo = false }: AllJobsTimelineProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailMap, setDetailMap] = useState<Record<string, JobWithEvents>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "company">("recent");

  async function expand(job: JobApplication) {
    if (expandedId === job.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(job.id);

    // Already fetched?
    if (detailCache[job.id]) {
      setDetailMap((prev) => ({ ...prev, [job.id]: detailCache[job.id] }));
      return;
    }

    if (isDemo) {
      // Synthetic email events for demo
      const demo: JobWithEvents = {
        ...job,
        email_events: [
          {
            id: "e1", job_id: job.id, user_id: "demo",
            event_type: "applied",
            event_date: job.applied_date ?? new Date().toISOString(),
            email_subject: `Application received — ${job.role ?? "the role"} at ${job.company}`,
            email_snippet: `Thank you for applying to ${job.company}. We have received your application and will be in touch.`,
            gmail_message_id: null, parsed_by: "demo", raw_extracted: null, created_at: job.created_at,
          },
          ...(job.status !== "applied" ? [{
            id: "e2", job_id: job.id, user_id: "demo",
            event_type: "interview",
            event_date: job.last_activity ?? new Date().toISOString(),
            email_subject: `Interview invitation — ${job.role ?? "the role"} at ${job.company}`,
            email_snippet: `We would like to invite you for an interview. Please reply to schedule a time.`,
            gmail_message_id: null, parsed_by: "demo", raw_extracted: null, created_at: job.created_at,
          }] : []),
        ],
      };
      detailCache[job.id] = demo;
      setDetailMap((prev) => ({ ...prev, [job.id]: demo }));
      return;
    }

    try {
      setLoadingId(job.id);
      const res = await fetch(`/api/jobs/${job.id}`);
      if (!res.ok) throw new Error("Not found");
      const data: JobWithEvents = await res.json();
      detailCache[job.id] = data;
      setDetailMap((prev) => ({ ...prev, [job.id]: data }));
    } catch {
      // Fall back to job without events
      const fallback: JobWithEvents = { ...job, email_events: [] };
      detailCache[job.id] = fallback;
      setDetailMap((prev) => ({ ...prev, [job.id]: fallback }));
    } finally {
      setLoadingId(null);
    }
  }

  const filtered = useMemo(() => {
    let result = [...jobs];
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (j) =>
          j.company.toLowerCase().includes(q) ||
          (j.role?.toLowerCase().includes(q) ?? false) ||
          (j.location?.toLowerCase().includes(q) ?? false)
      );
    }
    if (activeStatus) {
      result = result.filter((j) => j.status === activeStatus);
    }
    if (sortBy === "recent") {
      result.sort((a, b) =>
        new Date(b.last_activity || b.created_at).getTime() -
        new Date(a.last_activity || a.created_at).getTime()
      );
    } else {
      result.sort((a, b) => a.company.localeCompare(b.company));
    }
    return result;
  }, [jobs, query, activeStatus, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const j of jobs) counts[j.status] = (counts[j.status] ?? 0) + 1;
    return counts;
  }, [jobs]);

  return (
    <div className="py-6 px-4 lg:px-6 space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={isDemo ? "/dashboard?demo=true" : "/dashboard"}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-foreground">All Applications</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.length} application{jobs.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search company, role, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant={sortBy === "recent" ? "secondary" : "outline"}
          size="sm"
          onClick={() => setSortBy(sortBy === "recent" ? "company" : "recent")}
          className="shrink-0 text-xs h-9"
        >
          {sortBy === "recent" ? "Newest first" : "A–Z"}
        </Button>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setActiveStatus(null)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
            activeStatus === null
              ? "bg-foreground text-background border-foreground"
              : "border-border text-muted-foreground hover:border-foreground/40"
          )}
        >
          All ({jobs.length})
        </button>
        {ALL_STATUSES.filter((s) => (statusCounts[s] ?? 0) > 0).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const isActive = activeStatus === s;
          return (
            <button
              key={s}
              onClick={() => setActiveStatus(isActive ? null : s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                isActive
                  ? cn(cfg.bgColor, cfg.color, "border-transparent")
                  : "border-border text-muted-foreground hover:border-foreground/40"
              )}
            >
              {cfg.label} ({statusCounts[s]})
            </button>
          );
        })}
      </div>

      {/* Empty states */}
      {jobs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No applications yet. Add one from the dashboard.
        </div>
      )}
      {jobs.length > 0 && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No applications match your filters.{" "}
          <button
            onClick={() => { setQuery(""); setActiveStatus(null); }}
            className="underline underline-offset-2"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Job list */}
      <div className="space-y-2">
        {filtered.map((job) => {
          const isExpanded = expandedId === job.id;
          const isLoading  = loadingId === job.id;
          const detail     = detailMap[job.id];
          const statusCfg  = STATUS_CONFIG[job.status];
          const date       = job.last_activity || job.applied_date;
          const events     = detail?.email_events ?? [];

          return (
            <div key={job.id} className="rounded-lg border border-border overflow-hidden">
              {/* Row button */}
              <button onClick={() => expand(job)} className="w-full text-left">
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors",
                  isExpanded ? "bg-accent/40" : "bg-card hover:bg-accent/20"
                )}>
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
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {job.role && <span className="truncate">{job.role}</span>}
                      {job.role && job.location && <span>·</span>}
                      {job.location && (
                        <span className="flex items-center gap-0.5 shrink-0">
                          <MapPin className="w-3 h-3" />{job.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn(
                      "hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      statusCfg.bgColor, statusCfg.color
                    )}>
                      {statusCfg.label}
                    </span>
                    {date && (
                      <span className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(date), { addSuffix: true })}
                      </span>
                    )}
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </div>
              </button>

              {/* Expanded panel */}
              {isExpanded && (
                <div className="border-t border-border bg-background px-4 py-5 space-y-6">

                  {/* Stage progress */}
                  <StageProgress status={job.status} appliedDate={job.applied_date} />

                  {/* Meta row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Status", value: statusCfg.label, extra: cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", statusCfg.bgColor, statusCfg.color) },
                      job.platform ? { label: "Source", value: job.platform } : null,
                      job.applied_date ? { label: "Applied", value: formatDistanceToNow(new Date(job.applied_date), { addSuffix: true }) } : null,
                      job.deadline ? { label: "Deadline", value: formatDistanceToNow(new Date(job.deadline), { addSuffix: true }), warn: true } : null,
                    ].filter(Boolean).map((item, i) => item && (
                      <div key={i} className="space-y-0.5">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                        {item.extra
                          ? <span className={item.extra}>{item.value}</span>
                          : <p className={cn("text-sm font-medium", "warn" in item && item.warn ? "text-amber-500" : "text-foreground")}>
                              {item.value}
                            </p>
                        }
                      </div>
                    ))}
                  </div>

                  {/* Email event timeline */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Email History
                    </h3>

                    {isLoading && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading email history…
                      </div>
                    )}

                    {!isLoading && events.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">
                        No emails tracked yet for this application.
                      </p>
                    )}

                    {!isLoading && events.length > 0 && (
                      <div className="relative pl-6 space-y-5">
                        {/* Vertical line */}
                        <div className="absolute left-[9px] top-1 bottom-1 w-px bg-border" />

                        {events
                          .slice()
                          .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
                          .map((ev: EmailEvent) => {
                            const meta = eventMeta(ev.event_type);
                            const Icon = meta.icon;
                            return (
                              <div key={ev.id} className="relative">
                                {/* Dot */}
                                <div className={cn(
                                  "absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full border-2 border-background",
                                  "flex items-center justify-center bg-background",
                                )}>
                                  <Icon className={cn("w-3 h-3", meta.color)} />
                                </div>

                                {/* Content */}
                                <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-1.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-0.5 min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={cn("text-xs font-semibold", meta.color)}>
                                          {meta.label}
                                        </span>
                                      </div>
                                      {ev.email_subject && (
                                        <p className="text-sm font-medium text-foreground leading-snug">
                                          {ev.email_subject}
                                        </p>
                                      )}
                                    </div>
                                    <div className="text-right shrink-0 space-y-0.5">
                                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                                        {formatDistanceToNow(new Date(ev.event_date), { addSuffix: true })}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        {format(new Date(ev.event_date), "MMM d, yyyy")}
                                      </p>
                                    </div>
                                  </div>

                                  {ev.email_snippet && (
                                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-1.5">
                                      {ev.email_snippet}
                                    </p>
                                  )}

                                  {ev.gmail_message_id && !isDemo && (
                                    <a
                                      href={`https://mail.google.com/mail/u/0/#inbox/${ev.gmail_message_id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Open in Gmail
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

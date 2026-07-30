"use client";

import { useState } from "react";
import Image from "next/image";
import {
  MapPin, ExternalLink, Building2, Clock,
  BookmarkPlus, Bookmark, Check, Wifi, Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { JobSearchResult, SaveToTrackerPayload } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

// ─── Source badge colours ─────────────────────────────────────────────────────

const SOURCE_STYLES: Record<string, string> = {
  LinkedIn: "bg-[#0077b5]/10 text-[#0077b5] border-[#0077b5]/20",
  Indeed: "bg-[#003a9b]/10 text-[#003a9b] border-[#003a9b]/20",
  Glassdoor: "bg-[#0caa41]/10 text-[#0caa41] border-[#0caa41]/20",
  Naukri: "bg-[#FF7555]/10 text-[#FF7555] border-[#FF7555]/20",
};

function sourceBadgeClass(source: string): string {
  for (const [key, cls] of Object.entries(SOURCE_STYLES)) {
    if (source.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-secondary text-secondary-foreground border-border";
}

// ─── Salary formatting ────────────────────────────────────────────────────────

function formatSalary(
  min: number | null,
  max: number | null,
  currency: string | null,
  period: string | null,
): string | null {
  if (!min && !max) return null;
  const sym = currency ?? "";
  const per = period ? `/${period.toLowerCase().replace("_", "")}` : "";
  const fmt = (n: number) => (n >= 1000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${n}`);
  if (min && max) return `${fmt(min)} – ${fmt(max)}${per}`;
  if (min) return `From ${fmt(min)}${per}`;
  if (max) return `Up to ${fmt(max)}${per}`;
  return null;
}

// ─── Main Card ────────────────────────────────────────────────────────────────

interface JobSearchCardProps {
  job: JobSearchResult;
  isBookmarked?: boolean;
  onToggleBookmark?: (job: JobSearchResult) => void;
  onView?: (job: JobSearchResult) => void;
}

export function JobSearchCard({ job, isBookmarked = false, onToggleBookmark, onView }: JobSearchCardProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const postedAgo = job.postedAt
    ? formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })
    : null;

  async function handleSave() {
    if (saved || saving) return;
    setSaving(true);

    const payload: SaveToTrackerPayload = {
      company: job.company,
      role: job.title,
      location: job.isRemote ? "Remote" : job.location,
      platform: job.source,
      status: "applied",
      applied_date: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }

      setSaved(true);
      toast({
        title: "Saved to tracker",
        description: `${job.title} at ${job.company} added to your applications.`,
      });
    } catch (err) {
      toast({
        title: "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleApplyClick() {
    onView?.(job);
  }

  return (
    <Card className="p-4 flex flex-col gap-3 hover:bg-accent/30 transition-colors h-full">
      {/* Top row: logo + title + badges */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {job.companyLogo && !logoError ? (
            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-border bg-card">
              <Image
                src={job.companyLogo}
                alt={`${job.company} logo`}
                fill
                className="object-contain p-1"
                onError={() => setLogoError(true)}
                unoptimized
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-secondary border border-border shrink-0">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground leading-snug text-pretty line-clamp-2">
            {job.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.company}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="outline"
            className={`text-[11px] font-medium border ${sourceBadgeClass(job.source)}`}
          >
            {job.source}
          </Badge>
          {/* Bookmark button */}
          {onToggleBookmark && (
            <button
              onClick={() => onToggleBookmark(job)}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark this job"}
              className={`p-1 rounded-md transition-colors ${
                isBookmarked
                  ? "text-primary hover:text-muted-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isBookmarked ? (
                <Bookmark className="w-4 h-4 fill-current" />
              ) : (
                <BookmarkPlus className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {(job.isRemote || job.location) && (
          <span className="flex items-center gap-1">
            {job.isRemote ? (
              <><Wifi className="w-3 h-3 shrink-0" />Remote</>
            ) : (
              <><MapPin className="w-3 h-3 shrink-0" /><span className="truncate max-w-[140px]">{job.location}</span></>
            )}
          </span>
        )}
        {job.employmentType && (
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 shrink-0" />
            {job.employmentType.charAt(0) + job.employmentType.slice(1).toLowerCase()}
          </span>
        )}
        {postedAgo && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {postedAgo}
          </span>
        )}
      </div>

      {/* Salary — only rendered when data exists */}
      {salary && (
        <p className="text-xs font-medium text-foreground">{salary}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1.5 text-xs h-8"
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saved ? (
            <><Check className="w-3.5 h-3.5" /> Saved</>
          ) : saving ? (
            <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Saving...</>
          ) : (
            <><BookmarkPlus className="w-3.5 h-3.5" /> Add to tracker</>
          )}
        </Button>
        <Button size="sm" asChild className="flex-1 gap-1.5 text-xs h-8">
          <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={handleApplyClick}>
            Apply <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      </div>
    </Card>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function JobSearchCardSkeleton() {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full shrink-0" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="flex gap-2 mt-auto">
        <Skeleton className="h-8 flex-1 rounded-md" />
        <Skeleton className="h-8 flex-1 rounded-md" />
      </div>
    </Card>
  );
}

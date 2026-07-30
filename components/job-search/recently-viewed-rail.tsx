"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Clock, Building2, Wifi, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkPlus } from "lucide-react";
import Image from "next/image";
import type { JobSearchResult } from "@/lib/types";
import { useState } from "react";

// ─── Source badge colours (mirrored from job-search-card) ────────────────────

const SOURCE_STYLES: Record<string, string> = {
  LinkedIn: "bg-[#0077b5]/10 text-[#0077b5] border-[#0077b5]/20",
  Indeed: "bg-[#003a9b]/10 text-[#003a9b] border-[#003a9b]/20",
  Glassdoor: "bg-[#0caa41]/10 text-[#0caa41] border-[#0caa41]/20",
  Naukri: "bg-[#FF7555]/10 text-[#FF7555] border-[#FF7555]/20",
};

function sourceBadgeClass(source: string) {
  for (const [key, cls] of Object.entries(SOURCE_STYLES)) {
    if (source.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-secondary text-secondary-foreground border-border";
}

interface RecentlyViewedRailProps {
  jobs: JobSearchResult[];
  isBookmarked: (id: string) => boolean;
  onToggleBookmark: (job: JobSearchResult) => void;
  onView: (job: JobSearchResult) => void;
}

export function RecentlyViewedRail({ jobs, isBookmarked, onToggleBookmark, onView }: RecentlyViewedRailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" });
  }

  if (jobs.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="w-4 h-4 text-muted-foreground" />
          Recently viewed
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => scroll("left")}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {jobs.map((job) => (
          <RecentCard
            key={job.id}
            job={job}
            isBookmarked={isBookmarked(job.id)}
            onToggleBookmark={onToggleBookmark}
            onView={onView}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Mini card ────────────────────────────────────────────────────────────────

function RecentCard({
  job,
  isBookmarked,
  onToggleBookmark,
  onView,
}: {
  job: JobSearchResult;
  isBookmarked: boolean;
  onToggleBookmark: (job: JobSearchResult) => void;
  onView: (job: JobSearchResult) => void;
}) {
  const [logoError, setLogoError] = useState(false);

  return (
    <a
      href={job.applyUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onView(job)}
      className="shrink-0 w-60 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors p-3 flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-2">
        {job.companyLogo && !logoError ? (
          <div className="relative w-8 h-8 rounded-md overflow-hidden border border-border bg-card shrink-0">
            <Image
              src={job.companyLogo}
              alt={`${job.company} logo`}
              fill
              className="object-contain p-0.5"
              onError={() => setLogoError(true)}
              unoptimized
            />
          </div>
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-secondary border border-border shrink-0">
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 text-pretty">{job.title}</p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{job.company}</p>
        </div>

        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleBookmark(job); }}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
          className={`p-0.5 rounded transition-colors shrink-0 ${isBookmarked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          {isBookmarked
            ? <Bookmark className="w-3.5 h-3.5 fill-current" />
            : <BookmarkPlus className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {job.isRemote
            ? <><Wifi className="w-3 h-3" />Remote</>
            : <><MapPin className="w-3 h-3" /><span className="truncate max-w-[80px]">{job.location ?? "–"}</span></>
          }
        </span>
        <Badge variant="outline" className={`text-[10px] font-medium border px-1.5 py-0 ${sourceBadgeClass(job.source)}`}>
          {job.source}
        </Badge>
      </div>
    </a>
  );
}

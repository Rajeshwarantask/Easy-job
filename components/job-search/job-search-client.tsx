"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, MapPin, SlidersHorizontal, X, RefreshCw,
  AlertCircle, Briefcase, Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { JobSearchCard } from "@/components/job-search/job-search-card";
import { JobSearchCardSkeleton } from "@/components/job-search/job-search-card";
import { RecentlyViewedRail } from "@/components/job-search/recently-viewed-rail";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import type {
  JobSearchFilters, JobSearchResult,
  JobSearchDateFilter, JobSearchExpLevel, JobSearchType,
} from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const SALARY_MAX_BOUND = 300000;

const DEFAULT_FILTERS: JobSearchFilters = {
  query: "",
  location: "",
  remoteOnly: false,
  datePosted: "all",
  experienceLevel: "all",
  jobType: "all",
  salaryMin: null,
  salaryMax: null,
  page: 1,
};

const DATE_OPTIONS: { value: JobSearchDateFilter; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Past 24 hours" },
  { value: "3days", label: "Past 3 days" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
];

const EXP_OPTIONS: { value: JobSearchExpLevel; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "no_experience", label: "No experience / Fresher" },
  { value: "under_3_years_experience", label: "Entry level (0–3 yrs)" },
  { value: "more_than_3_years_experience", label: "Mid / Senior (3+ yrs)" },
];

const TYPE_OPTIONS: { value: JobSearchType; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "FULLTIME", label: "Full-time" },
  { value: "PARTTIME", label: "Part-time" },
  { value: "INTERN", label: "Internship" },
  { value: "CONTRACTOR", label: "Contract" },
];

// ─── Cache (per-session, keyed by serialised filters) ────────────────────────

interface CacheEntry {
  results: JobSearchResult[];
  hasMore: boolean;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

function filtersKey(f: JobSearchFilters) {
  return JSON.stringify(f);
}

function formatSalaryLabel(val: number) {
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
  return `$${val}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function JobSearchClient() {
  const [filters, setFilters] = useState<JobSearchFilters>(DEFAULT_FILTERS);
  const [queryInput, setQueryInput] = useState("");
  const [locationInput, setLocationInput] = useState("");

  // Salary slider local state — separate from filters so we debounce it too
  const [salaryRange, setSalaryRange] = useState<[number, number]>([0, SALARY_MAX_BOUND]);

  const [results, setResults] = useState<JobSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"results" | "bookmarks">("results");

  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salaryDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const { recentlyViewed, pushViewed } = useRecentlyViewed();

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async (activeFilters: JobSearchFilters, append = false) => {
    const key = filtersKey(activeFilters);
    const cached = cache.current.get(key);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      if (append) setResults((p) => [...p, ...cached.results]);
      else setResults(cached.results);
      setHasMore(cached.hasMore);
      setHasSearched(true);
      return;
    }

    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        query: activeFilters.query || "developer",
        location: activeFilters.location,
        remoteOnly: String(activeFilters.remoteOnly),
        datePosted: activeFilters.datePosted,
        experienceLevel: activeFilters.experienceLevel,
        jobType: activeFilters.jobType,
        page: String(activeFilters.page),
        ...(activeFilters.salaryMin != null ? { salaryMin: String(activeFilters.salaryMin) } : {}),
        ...(activeFilters.salaryMax != null && activeFilters.salaryMax < SALARY_MAX_BOUND
          ? { salaryMax: String(activeFilters.salaryMax) }
          : {}),
      });

      const res = await fetch(`/api/job-search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError({ code: data.error ?? "error", message: data.message ?? "Something went wrong." });
        return;
      }

      const newResults: JobSearchResult[] = data.results ?? [];
      const newHasMore: boolean = data.hasMore ?? false;

      cache.current.set(key, { results: newResults, hasMore: newHasMore, timestamp: Date.now() });

      if (append) setResults((p) => [...p, ...newResults]);
      else setResults(newResults);
      setHasMore(newHasMore);
      setHasSearched(true);
    } catch {
      setError({ code: "network_error", message: "Could not reach the job search service. Check your connection." });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // ─── Debounce text inputs ──────────────────────────────────────────────────

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, query: queryInput, location: locationInput, page: 1 }));
    }, 500);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [queryInput, locationInput]);

  // ─── Debounce salary slider ────────────────────────────────────────────────

  useEffect(() => {
    if (salaryDebounce.current) clearTimeout(salaryDebounce.current);
    salaryDebounce.current = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        salaryMin: salaryRange[0] > 0 ? salaryRange[0] : null,
        salaryMax: salaryRange[1] < SALARY_MAX_BOUND ? salaryRange[1] : null,
        page: 1,
      }));
    }, 600);
    return () => { if (salaryDebounce.current) clearTimeout(salaryDebounce.current); };
  }, [salaryRange]);

  // ─── Auto-fetch on filter changes ─────────────────────────────────────────

  useEffect(() => {
    const isDefault =
      !filters.query && !filters.location &&
      !filters.remoteOnly && filters.datePosted === "all" &&
      filters.experienceLevel === "all" && filters.jobType === "all" &&
      filters.salaryMin == null && filters.salaryMax == null;
    if (isDefault) return;
    fetchJobs(filters, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  function loadMore() {
    const next = { ...filters, page: filters.page + 1 };
    setFilters(next);
    fetchJobs(next, true);
  }

  function updateFilter<K extends keyof JobSearchFilters>(key: K, value: JobSearchFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function resetFilters() {
    setQueryInput("");
    setLocationInput("");
    setSalaryRange([0, SALARY_MAX_BOUND]);
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setHasSearched(false);
    setError(null);
  }

  function handleSearch() {
    const active = { ...filters, query: queryInput, location: locationInput, page: 1 };
    setFilters(active);
    fetchJobs(active, false);
  }

  // Mark a job viewed when the user clicks Apply
  function handleView(job: JobSearchResult) {
    pushViewed(job);
  }

  const salaryActive = salaryRange[0] > 0 || salaryRange[1] < SALARY_MAX_BOUND;

  const activeFilterCount = [
    filters.datePosted !== "all",
    filters.experienceLevel !== "all",
    filters.jobType !== "all",
    filters.remoteOnly,
    salaryActive,
  ].filter(Boolean).length;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Job Search</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search across LinkedIn, Indeed, Glassdoor, Naukri and more. Save any listing to your tracker or bookmarks.
          </p>
        </div>
        {/* Bookmarks tab toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shrink-0">
          <button
            onClick={() => setActiveTab("results")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "results"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Results
          </button>
          <button
            onClick={() => setActiveTab("bookmarks")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === "bookmarks"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className="w-3 h-3" />
            Saved
            {bookmarks.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px]">
                {bookmarks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Bookmarks panel ── */}
      {activeTab === "bookmarks" && (
        <BookmarksPanel bookmarks={bookmarks} isBookmarked={isBookmarked} onToggle={toggleBookmark} onView={handleView} />
      )}

      {/* ── Search + results panel ── */}
      {activeTab === "results" && (
        <>
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Job title, skill, or keyword..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <div className="relative w-52 hidden sm:block">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="City or country..."
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              className="relative gap-2 shrink-0"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button onClick={handleSearch} disabled={loading} className="shrink-0">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search"}
            </Button>
          </div>

          {/* Location — mobile only */}
          <div className="relative sm:hidden">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="City or country..."
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Expanded filter panel */}
          {showFilters && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Filters</span>
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date posted</label>
                  <Select value={filters.datePosted} onValueChange={(v) => updateFilter("datePosted", v as JobSearchDateFilter)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Experience level</label>
                  <Select value={filters.experienceLevel} onValueChange={(v) => updateFilter("experienceLevel", v as JobSearchExpLevel)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXP_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Job type</label>
                  <Select value={filters.jobType} onValueChange={(v) => updateFilter("jobType", v as JobSearchType)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Salary range slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Salary range</label>
                  <span className="text-xs text-foreground font-medium tabular-nums">
                    {formatSalaryLabel(salaryRange[0])} – {salaryRange[1] >= SALARY_MAX_BOUND ? "Any" : formatSalaryLabel(salaryRange[1])}
                  </span>
                </div>
                <Slider
                  min={0}
                  max={SALARY_MAX_BOUND}
                  step={5000}
                  value={salaryRange}
                  onValueChange={(v) => setSalaryRange(v as [number, number])}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>$0</span>
                  <span>$300k+</span>
                </div>
              </div>

              {/* Remote toggle */}
              <button
                onClick={() => updateFilter("remoteOnly", !filters.remoteOnly)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                  filters.remoteOnly
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              >
                Remote only
                {filters.remoteOnly && <X className="w-3 h-3" />}
              </button>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2">
              {filters.remoteOnly && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => updateFilter("remoteOnly", false)}>
                  Remote only <X className="w-3 h-3" />
                </Badge>
              )}
              {filters.datePosted !== "all" && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => updateFilter("datePosted", "all")}>
                  {DATE_OPTIONS.find((o) => o.value === filters.datePosted)?.label} <X className="w-3 h-3" />
                </Badge>
              )}
              {filters.experienceLevel !== "all" && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => updateFilter("experienceLevel", "all")}>
                  {EXP_OPTIONS.find((o) => o.value === filters.experienceLevel)?.label} <X className="w-3 h-3" />
                </Badge>
              )}
              {filters.jobType !== "all" && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => updateFilter("jobType", "all")}>
                  {TYPE_OPTIONS.find((o) => o.value === filters.jobType)?.label} <X className="w-3 h-3" />
                </Badge>
              )}
              {salaryActive && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => { setSalaryRange([0, SALARY_MAX_BOUND]); updateFilter("salaryMin", null); updateFilter("salaryMax", null); }}>
                  {formatSalaryLabel(salaryRange[0])} – {salaryRange[1] >= SALARY_MAX_BOUND ? "Any" : formatSalaryLabel(salaryRange[1])} <X className="w-3 h-3" />
                </Badge>
              )}
            </div>
          )}

          {/* Recently viewed rail — only when idle or between searches */}
          {!hasSearched && recentlyViewed.length > 0 && (
            <RecentlyViewedRail
              jobs={recentlyViewed}
              isBookmarked={isBookmarked}
              onToggleBookmark={toggleBookmark}
              onView={handleView}
            />
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <JobSearchCardSkeleton key={i} />)}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {error.code === "quota_exceeded" ? "Rate limit reached" : "Something went wrong"}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error.message}</p>
              </div>
              {error.code !== "quota_exceeded" && (
                <Button variant="outline" size="sm" onClick={handleSearch}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Try again
                </Button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted">
                <Briefcase className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No jobs found</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Try broadening your search — remove some filters or use a more general keyword.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <X className="w-4 h-4 mr-2" /> Clear filters
              </Button>
            </div>
          )}

          {/* Idle state */}
          {!loading && !error && !hasSearched && recentlyViewed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary">
                <Search className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Enter a role or keyword above to search jobs from LinkedIn, Indeed, Glassdoor, Naukri and more.
              </p>
            </div>
          )}

          {/* Results grid */}
          {!loading && !error && results.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {results.length} result{results.length !== 1 ? "s" : ""}
                {filters.query ? ` for "${filters.query}"` : ""}
                {filters.location ? ` in ${filters.location}` : ""}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((job) => (
                  <JobSearchCard
                    key={job.id}
                    job={job}
                    isBookmarked={isBookmarked(job.id)}
                    onToggleBookmark={toggleBookmark}
                    onView={handleView}
                  />
                ))}
                {loadingMore && Array.from({ length: 4 }).map((_, i) => <JobSearchCardSkeleton key={`more-${i}`} />)}
              </div>

              {hasMore && !loadingMore && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={loadMore}>Load more jobs</Button>
                </div>
              )}

              {!hasMore && results.length > 0 && (
                <p className="text-center text-xs text-muted-foreground py-4">
                  No more results for this search.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Bookmarks panel ─────────────────────────────────────────────────────────

function BookmarksPanel({
  bookmarks,
  isBookmarked,
  onToggle,
  onView,
}: {
  bookmarks: import("@/lib/types").JobSearchResult[];
  isBookmarked: (id: string) => boolean;
  onToggle: (job: import("@/lib/types").JobSearchResult) => void;
  onView: (job: import("@/lib/types").JobSearchResult) => void;
}) {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary">
          <Bookmark className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="font-medium text-foreground">No saved jobs yet</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Bookmark any job from search results — they&apos;ll appear here so you can revisit them later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{bookmarks.length} saved job{bookmarks.length !== 1 ? "s" : ""}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bookmarks.map((job) => (
          <JobSearchCard
            key={job.id}
            job={job}
            isBookmarked={isBookmarked(job.id)}
            onToggleBookmark={onToggle}
            onView={onView}
          />
        ))}
      </div>
    </div>
  );
}

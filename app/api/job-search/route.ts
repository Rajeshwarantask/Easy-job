import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type {
  JSearchResponse,
  JobSearchResult,
  JobSearchDateFilter,
  JobSearchExpLevel,
  JobSearchType,
} from "@/lib/types";

// Maps our friendly filter values to JSearch query params
const DATE_FILTER_MAP: Record<JobSearchDateFilter, string | null> = {
  all: null,
  today: "today",
  "3days": "3days",
  week: "week",
  month: "month",
};

const EXP_LEVEL_MAP: Record<JobSearchExpLevel, string | null> = {
  all: null,
  no_experience: "no_experience",
  under_3_years_experience: "under_3_years_experience",
  more_than_3_years_experience: "more_than_3_years_experience",
};

const JOB_TYPE_MAP: Record<JobSearchType, string | null> = {
  all: null,
  FULLTIME: "FULLTIME",
  PARTTIME: "PARTTIME",
  INTERN: "INTERN",
  CONTRACTOR: "CONTRACTOR",
};

function normalizeLocation(city: string | null, state: string | null, country: string | null): string | null {
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function normalizeResult(job: JSearchResponse["data"][number]): JobSearchResult {
  return {
    id: job.job_id,
    title: job.job_title,
    company: job.employer_name,
    companyLogo: job.employer_logo ?? null,
    source: job.job_publisher,
    employmentType: job.job_employment_type ?? null,
    applyUrl: job.job_apply_link,
    location: normalizeLocation(job.job_city, job.job_state, job.job_country),
    isRemote: job.job_is_remote ?? false,
    postedAt: job.job_posted_at_datetime_utc ?? null,
    salaryMin: job.job_min_salary ?? null,
    salaryMax: job.job_max_salary ?? null,
    salaryCurrency: job.job_salary_currency ?? null,
    salaryPeriod: job.job_salary_period ?? null,
    description: job.job_description ?? null,
  };
}

export async function GET(request: Request) {
  // Auth guard — this API route must be independently protected
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RAPIDAPI_KEY is not configured. Add it in project settings → Vars." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() || "software developer";
  const location = searchParams.get("location")?.trim() || "";
  const remoteOnly = searchParams.get("remoteOnly") === "true";
  const datePosted = (searchParams.get("datePosted") as JobSearchDateFilter) || "all";
  const experienceLevel = (searchParams.get("experienceLevel") as JobSearchExpLevel) || "all";
  const jobType = (searchParams.get("jobType") as JobSearchType) || "all";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  // Build JSearch query string — append location to query for best results
  const fullQuery = location ? `${query} in ${location}` : query;

  const params = new URLSearchParams({
    query: fullQuery,
    page: String(page),
    num_pages: "1",
    language: "en",
  });

  if (remoteOnly) params.set("remote_jobs_only", "true");
  const dateVal = DATE_FILTER_MAP[datePosted];
  if (dateVal) params.set("date_posted", dateVal);
  const expVal = EXP_LEVEL_MAP[experienceLevel];
  if (expVal) params.set("job_requirements", expVal);
  const typeVal = JOB_TYPE_MAP[jobType];
  if (typeVal) params.set("employment_types", typeVal);

  try {
    const res = await fetch(
      `https://jsearch.p.rapidapi.com/search?${params.toString()}`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
        // Next.js — don't cache at the CDN level; client-side caching handles this
        cache: "no-store",
      }
    );

    if (res.status === 429) {
      return NextResponse.json(
        { error: "quota_exceeded", message: "API rate limit reached. Please wait a moment before searching again." },
        { status: 429 }
      );
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[job-search] JSearch error:", res.status, text);
      return NextResponse.json(
        { error: "upstream_error", message: "Failed to fetch jobs. Please try again." },
        { status: 502 }
      );
    }

    const json: JSearchResponse = await res.json();
    const results: JobSearchResult[] = (json.data ?? []).map(normalizeResult);

    // JSearch returns up to 10 results per page; if we got a full page there may be more
    const hasMore = results.length === 10;

    return NextResponse.json({ results, page, hasMore });
  } catch (err) {
    console.error("[job-search] Fetch failed:", err);
    return NextResponse.json(
      { error: "network_error", message: "Could not reach the job search service. Check your connection and try again." },
      { status: 503 }
    );
  }
}

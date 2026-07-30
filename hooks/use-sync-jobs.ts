"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { JobApplication } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────
export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface CacheState {
  jobs: JobApplication[];
  lastSynced: Date | null;
  status: SyncStatus;
  errorMessage: string | null;
  listeners: Set<() => void>;
}

// ─── sessionStorage key ───────────────────────────────────────────────────────
const SS_KEY = "jobtrail_cache";
const STALE_MS = 5 * 60 * 1000;   // 5 min before auto-sync
const POLL_MS  = 3 * 60 * 1000;   // 3 min background poll (read-only, never wipes)

// ─── Rehydrate from sessionStorage (runs once per module load) ────────────────
function loadFromSession(): Pick<CacheState, "jobs" | "lastSynced"> {
  if (typeof window === "undefined") return { jobs: [], lastSynced: null };
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return { jobs: [], lastSynced: null };
    const parsed = JSON.parse(raw);
    return {
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      lastSynced: parsed.lastSynced ? new Date(parsed.lastSynced) : null,
    };
  } catch {
    return { jobs: [], lastSynced: null };
  }
}

function saveToSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SS_KEY,
      JSON.stringify({
        jobs: cache.jobs,
        lastSynced: cache.lastSynced?.toISOString() ?? null,
      })
    );
  } catch {
    // quota exceeded — ignore
  }
}

// ─── Module-level singleton ───────────────────────────────────────────────────
// Rehydrated from sessionStorage immediately so every route gets the same data.
const hydrated = loadFromSession();

const cache: CacheState = {
  jobs: hydrated.jobs,
  lastSynced: hydrated.lastSynced,
  status: hydrated.jobs.length > 0 ? "success" : "idle",
  errorMessage: null,
  listeners: new Set(),
};

let isSyncing = false;

function notify() {
  cache.listeners.forEach((fn) => fn());
}

async function fetchJobs(): Promise<JobApplication[]> {
  const res = await fetch("/api/jobs");
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
}

export async function runSync(force = false) {
  if (isSyncing) return;

  const isStale =
    !cache.lastSynced ||
    Date.now() - cache.lastSynced.getTime() > STALE_MS;

  // If cache already has jobs and isn't stale, skip network call entirely
  if (!force && !isStale && cache.jobs.length > 0) return;

  isSyncing = true;
  cache.status = "syncing";
  cache.errorMessage = null;
  notify();

  try {
    const res = await fetch("/api/sync", { method: "POST" });
    const data = await res.json();

    if (!res.ok || data.error) {
      cache.status = "error";
      cache.errorMessage = data.error ?? "Sync failed";
      try {
        cache.jobs = await fetchJobs();
        saveToSession();
      } catch { /* ignore */ }
      notify();
      return;
    }

    const fetched = await fetchJobs();
    // Only replace jobs if the server actually returned data.
    // If it returned empty (cold-start race), keep what sessionStorage has.
    if (fetched.length > 0 || cache.jobs.length === 0) {
      cache.jobs = fetched;
    }
    cache.lastSynced = new Date();
    cache.status = "success";
    saveToSession();
    notify();
  } catch {
    cache.status = "error";
    cache.errorMessage = "Network error — could not reach server";
  } finally {
    isSyncing = false;
    notify();
  }
}

async function pollJobs() {
  if (isSyncing) return;
  try {
    const jobs = await fetchJobs();
    // CRITICAL: never overwrite a populated cache with an empty array.
    // An empty response means the server-side store was cold-started and lost
    // its in-memory data — trigger a full re-sync instead of wiping the UI.
    if (jobs.length === 0 && cache.jobs.length > 0) {
      // Server lost its state — re-sync silently to repopulate it
      runSync(true);
      return;
    }
    if (jobs.length > 0) {
      cache.jobs = jobs;
      saveToSession();
      notify();
    }
  } catch { /* silent */ }
}

// ─── React hook ───────────────────────────────────────────────────────────────
interface UseSyncJobsOptions {
  initialJobs?: JobApplication[];
  isDemo?: boolean;
}

export interface UseSyncJobsReturn {
  jobs: JobApplication[];
  status: SyncStatus;
  lastSynced: Date | null;
  errorMessage: string | null;
  sync: () => Promise<void>;
}

export function useSyncJobs({
  initialJobs = [],
  isDemo = false,
}: UseSyncJobsOptions = {}): UseSyncJobsReturn {
  // Seed cache from SSR props only when cache is completely empty
  if (!isDemo && initialJobs.length > 0 && cache.jobs.length === 0) {
    cache.jobs = initialJobs;
    saveToSession();
  }

  const [, forceRender] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isDemo) return;

    const listener = () => forceRender((n) => n + 1);
    cache.listeners.add(listener);

    // Only triggers if cache is stale or empty — no-op on navigation back
    runSync();

    pollRef.current = setInterval(pollJobs, POLL_MS);

    return () => {
      cache.listeners.delete(listener);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const sync = useCallback(async () => {
    if (isDemo) return;
    await runSync(true);
  }, [isDemo]);

  return {
    jobs: isDemo ? initialJobs : cache.jobs,
    status: isDemo ? "idle" : cache.status,
    lastSynced: isDemo ? null : cache.lastSynced,
    errorMessage: isDemo ? null : cache.errorMessage,
    sync,
  };
}

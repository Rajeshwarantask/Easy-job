"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobSearchResult } from "@/lib/types";

const STORAGE_KEY = "jobtrail:recently-viewed";
const MAX_ITEMS = 20;

function readStorage(): JobSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as JobSearchResult[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: JobSearchResult[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full — silently ignore
  }
}

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<JobSearchResult[]>([]);

  useEffect(() => {
    setRecentlyViewed(readStorage());
  }, []);

  /** Push a job to the front of the ring buffer, deduplicating and capping at MAX_ITEMS */
  const pushViewed = useCallback((job: JobSearchResult) => {
    setRecentlyViewed((prev) => {
      const deduped = prev.filter((j) => j.id !== job.id);
      const next = [job, ...deduped].slice(0, MAX_ITEMS);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearRecentlyViewed = useCallback(() => {
    writeStorage([]);
    setRecentlyViewed([]);
  }, []);

  return { recentlyViewed, pushViewed, clearRecentlyViewed };
}

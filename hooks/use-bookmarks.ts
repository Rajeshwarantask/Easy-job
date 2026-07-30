"use client";

import { useState, useEffect, useCallback } from "react";
import type { JobSearchResult } from "@/lib/types";

const STORAGE_KEY = "jobtrail:bookmarks";

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

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<JobSearchResult[]>([]);

  // Hydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    setBookmarks(readStorage());
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((b) => b.id === id),
    [bookmarks]
  );

  const toggleBookmark = useCallback((job: JobSearchResult) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === job.id);
      const next = exists ? prev.filter((b) => b.id !== job.id) : [job, ...prev];
      writeStorage(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      writeStorage(next);
      return next;
    });
  }, []);

  const clearBookmarks = useCallback(() => {
    writeStorage([]);
    setBookmarks([]);
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearBookmarks };
}

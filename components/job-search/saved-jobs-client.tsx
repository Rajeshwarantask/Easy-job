"use client";

import Link from "next/link";
import { Bookmark, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobSearchCard } from "@/components/job-search/job-search-card";
import { useBookmarks } from "@/hooks/use-bookmarks";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";

export function SavedJobsClient() {
  const { bookmarks, isBookmarked, toggleBookmark, clearBookmarks } = useBookmarks();
  const { pushViewed } = useRecentlyViewed();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground text-balance">Saved Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bookmarked listings stored locally in your browser.
          </p>
        </div>
        {bookmarks.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
            onClick={clearBookmarks}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </Button>
        )}
      </div>

      {/* Empty state */}
      {bookmarks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary">
            <Bookmark className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">No saved jobs yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Bookmark jobs from the search page and they&apos;ll appear here for easy access later.
            </p>
          </div>
          <Button asChild>
            <Link href="/job-search">
              <Search className="w-4 h-4 mr-2" />
              Browse jobs
            </Link>
          </Button>
        </div>
      )}

      {/* Grid */}
      {bookmarks.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            {bookmarks.length} saved job{bookmarks.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bookmarks.map((job) => (
              <JobSearchCard
                key={job.id}
                job={job}
                isBookmarked={isBookmarked(job.id)}
                onToggleBookmark={toggleBookmark}
                onView={pushViewed}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

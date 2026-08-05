"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RecentJobsList } from "@/components/dashboard/recent-jobs-list";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import type { ParsedApplication } from "@/lib/types";

export function DashboardClient() {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Load applications from sessionStorage on mount
  useEffect(() => {
    const cached = sessionStorage.getItem("jobtrail:cache");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        // Validate cache version and expiry
        if (data.version === 1 && data.applications) {
          setApplications(data.applications);
          if (data.lastSync) {
            setLastSynced(new Date(data.lastSync));
          }
        }
      } catch {
        // Ignore parse errors, will re-sync
      }
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch("/api/parsing/sync", {
        method: "POST",
      });
      if (response.ok) {
        const result = await response.json();
        const parsed = result.applications || [];
        setApplications(parsed);
        const syncTime = new Date();
        setLastSynced(syncTime);

        // Save to sessionStorage with versioning and metadata
        sessionStorage.setItem(
          "jobtrail:cache",
          JSON.stringify({
            version: 1,
            applications: parsed,
            lastSync: syncTime.toISOString(),
            parserVersion: result.summary?.parserVersion || "1.0.0",
            gmailHistoryId: result.summary?.lastGmailHistoryId || null,
            syncDurationMs: result.syncDurationMs,
          })
        );
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {applications.length} application{applications.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Gmail"}
        </Button>
      </div>

      <SyncStatusBar lastSynced={lastSynced} status={syncing ? "syncing" : "idle"} />

      <DashboardStats applications={applications} />

      {applications.length === 0 ? (
        <EmptyState onSync={handleSync} />
      ) : (
        <RecentJobsList applications={applications} />
      )}
    </div>
  );
}

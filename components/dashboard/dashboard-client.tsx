"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
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
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-card/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Header */}
        <div className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    Application Tracker
                  </h1>
                  <p className="text-base text-muted-foreground mt-1">
                    Gmail-powered recruitment email parsing and organization
                  </p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="lg"
              className="self-start sm:self-auto gap-2 font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing Gmail..." : "Sync Gmail"}
            </Button>
          </div>

          {/* Status cards row */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground font-medium">Total Applications</p>
              <p className="text-2xl font-bold text-foreground mt-1">{applications.length}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground font-medium">Last Synced</p>
              <p className="text-sm font-semibold text-foreground mt-1">
                {lastSynced ? new Date(lastSynced).toLocaleDateString() : "Never"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground font-medium">Parser Version</p>
              <p className="text-sm font-semibold text-foreground mt-1">1.0.0</p>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        {lastSynced && (
          <div className="mb-8">
            <SyncStatusBar
              status={syncing ? "syncing" : "success"}
              lastSynced={lastSynced}
            />
          </div>
        )}

        {/* Main Content */}
        {applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              No applications parsed yet
            </h2>
            <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
              Connect your Gmail and sync your recruitment emails to get started. Your emails will be automatically parsed and organized.
            </p>
            <Button onClick={handleSync} size="lg" className="gap-2">
              <Mail className="w-4 h-4" />
              Sync Gmail Now
            </Button>
          </div>
        ) : (
          <DashboardStats jobs={applications} lastSynced={lastSynced?.toISOString()} />
        )}
      </div>
    </div>
  );
}

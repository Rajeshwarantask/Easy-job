
"use client";

import { useState } from "react";
import { useSyncJobs } from "@/hooks/use-sync-jobs";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RecentJobsList } from "@/components/dashboard/recent-jobs-list";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import { Calendar, RefreshCw } from "lucide-react";
import type { JobApplication } from "@/lib/types";

// ---- Demo data (shown when ?demo=true) ----
const demoJobs: JobApplication[] = [
  {
    id: "demo-1", user_id: "demo", company: "Vercel", company_normalized: "vercel",
    role: "Senior Frontend Engineer", location: "Remote", platform: "LinkedIn",
    status: "interview", is_new_update: true, gmail_thread_id: null,
    applied_date: new Date(Date.now() - 7 * 86400000).toISOString(),
    last_activity: new Date(Date.now() - 2 * 86400000).toISOString(),
    deadline: null, deadline_label: null,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "demo-2", user_id: "demo", company: "Stripe", company_normalized: "stripe",
    role: "Full Stack Developer", location: "San Francisco, CA", platform: "Company Website",
    status: "applied", is_new_update: false, gmail_thread_id: null,
    applied_date: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_activity: new Date(Date.now() - 3 * 86400000).toISOString(),
    deadline: null, deadline_label: null,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "demo-3", user_id: "demo", company: "Figma", company_normalized: "figma",
    role: "Product Designer", location: "New York, NY", platform: "Referral",
    status: "applied", is_new_update: false, gmail_thread_id: null,
    applied_date: new Date(Date.now() - 5 * 86400000).toISOString(),
    last_activity: new Date(Date.now() - 5 * 86400000).toISOString(),
    deadline: null, deadline_label: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "demo-4", user_id: "demo", company: "Linear", company_normalized: "linear",
    role: "Software Engineer", location: "Remote", platform: "LinkedIn",
    status: "offer", is_new_update: true, gmail_thread_id: null,
    applied_date: new Date(Date.now() - 14 * 86400000).toISOString(),
    last_activity: new Date(Date.now() - 1 * 86400000).toISOString(),
    deadline: null, deadline_label: null,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "demo-5", user_id: "demo", company: "Notion", company_normalized: "notion",
    role: "Frontend Engineer", location: "San Francisco, CA", platform: "AngelList",
    status: "rejected", is_new_update: false, gmail_thread_id: null,
    applied_date: new Date(Date.now() - 21 * 86400000).toISOString(),
    last_activity: new Date(Date.now() - 10 * 86400000).toISOString(),
    deadline: null, deadline_label: null,
    created_at: new Date(Date.now() - 21 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

interface DashboardClientProps {
  isDemo: boolean;
  serverJobs: JobApplication[];
  lastSyncedAt?: string | null;
}

export function DashboardClient({ isDemo, serverJobs, lastSyncedAt }: DashboardClientProps) {
  const { jobs, status, lastSynced, errorMessage } = useSyncJobs({
    initialJobs: isDemo ? demoJobs : serverJobs,
    isDemo,
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<number | "all">(7); // days or "all"
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [customDays, setCustomDays] = useState("");

  const displayJobs = isDemo ? demoJobs : jobs;
  const displayLastSynced = lastSynced?.toISOString() ?? lastSyncedAt ?? null;

  const handleStartSync = async () => {
    setIsSyncing(true);
    setShowDateSelector(false);
    
    try {
      const params: any = {};
      if (dateRange !== "all") {
        params.dateRange = `${dateRange}days`;
      }
      
      const response = await fetch("/api/sync", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("[v0] Sync complete:", data);
      }
    } catch (err) {
      console.error("[v0] Sync error:", err);
    } finally {
      setIsSyncing(false);
      window.location.reload();
    }
  };

  return (
    <div className="py-6 space-y-4 px-4 lg:px-6">
      {isDemo && (
        <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="text-sm text-yellow-500">
            Demo Mode — Sign in with Google to track your real applications
          </div>
        </div>
      )}

      {/* Sync status bar - compact */}
      {!isDemo && status !== "idle" && (
        <div className="text-center py-2">
          <SyncStatusBar
            status={status}
            lastSynced={lastSynced}
            errorMessage={errorMessage}
          />
        </div>
      )}

      {/* Centered sync button and date selector */}
      {!isDemo && displayJobs.length === 0 && !showDateSelector && (
        <div className="flex justify-center pt-8">
          <button
            onClick={() => setShowDateSelector(true)}
            disabled={isSyncing}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-base font-semibold transition flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Gmail"}
          </button>
        </div>
      )}

      {/* Date range selector modal */}
      {showDateSelector && !isSyncing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg max-w-sm w-full space-y-5 p-6">
            <div>
              <h3 className="text-lg font-semibold">Filter emails by date</h3>
              <p className="text-sm text-muted-foreground mt-1">Select how many days back to sync</p>
            </div>

            <div className="space-y-3">
              {[7, 15, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setDateRange(days)}
                  className={`w-full px-4 py-3 rounded-lg text-left transition ${
                    dateRange === days
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  <span className="font-medium">Last {days} days</span>
                </button>
              ))}
              
              <button
                onClick={() => setDateRange("all")}
                className={`w-full px-4 py-3 rounded-lg text-left transition ${
                  dateRange === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                <span className="font-medium">All time</span>
              </button>

              <div className="pt-2 border-t border-border">
                <label className="text-sm font-medium block mb-2">Or enter custom days:</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => {
                    setCustomDays(e.target.value);
                    if (e.target.value) {
                      setDateRange(parseInt(e.target.value) || 7);
                    }
                  }}
                  placeholder="e.g., 45"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground placeholder-muted-foreground text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleStartSync}
                disabled={isSyncing}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-medium transition"
              >
                {isSyncing ? "Syncing..." : "Start Sync"}
              </button>
              <button
                onClick={() => {
                  setShowDateSelector(false);
                  setCustomDays("");
                }}
                disabled={isSyncing}
                className="px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {displayJobs.length === 0 ? (
        <EmptyState lastSynced={displayLastSynced ? new Date(displayLastSynced) : null} />
      ) : (
        <>
          <DashboardStats jobs={displayJobs} lastSynced={displayLastSynced} />
          <RecentJobsList jobs={displayJobs} isDemo={isDemo} />
        </>
      )}
    </div>
  );
}

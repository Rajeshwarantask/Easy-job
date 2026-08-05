"use client";

/**
 * DEPRECATED: This hook is kept for backward compatibility only.
 * Use useSyncProgress() from use-sync-progress.ts for new code.
 */

import { useSyncProgress } from "./use-sync-progress";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface UseSyncJobsReturn {
  jobs: any[];
  status: SyncStatus;
  lastSynced: Date | null;
  errorMessage: string | null;
  sync: () => Promise<void>;
}

/**
 * Legacy compatibility wrapper. Maps new sync progress to old interface.
 * This is provided only for backward compatibility with existing components.
 */
export function useSyncJobs(): UseSyncJobsReturn {
  const syncProgress = useSyncProgress();

  const legacyStatus: SyncStatus = syncProgress.isComplete
    ? "success"
    : syncProgress.hasError
    ? "error"
    : syncProgress.isOpen
    ? "syncing"
    : "idle";

  return {
    jobs: [], // Legacy concept no longer used
    status: legacyStatus,
    lastSynced: null, // Not tracked in new system
    errorMessage: syncProgress.errorMessage || null,
    sync: async () => {
      syncProgress.startSync();
      // sync is triggered via API call in components
    },
  };
}

export async function runSync(force = false) {
  // Trigger sync via /api/parsing/sync
  try {
    const res = await fetch("/api/parsing/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    if (!res.ok) throw new Error("Sync failed");
  } catch (error) {
    console.error("[v0] Sync error:", error);
    throw error;
  }
}

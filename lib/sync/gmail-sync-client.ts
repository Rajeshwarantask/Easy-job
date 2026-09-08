"use client";

import { ApplicationStore } from "@/lib/store/application-store";

export type SyncRange = { from: string | null; to: string | null; label: string };
export type SyncSnapshot = { syncing: boolean; error: string | null; lastCompletedAt: string | null };

const listeners = new Set<(snapshot: SyncSnapshot) => void>();
let snapshot: SyncSnapshot = { syncing: false, error: null, lastCompletedAt: null };
let activeRequest: Promise<void> | null = null;

function publish(next: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribeToGmailSync(listener: (snapshot: SyncSnapshot) => void) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export function getGmailSyncSnapshot() {
  return snapshot;
}

export function formatSyncDate(date: Date | null) {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function syncGmail(range: SyncRange): Promise<void> {
  if (activeRequest) return activeRequest;

  activeRequest = (async () => {
    publish({ syncing: true, error: null });
    try {
      const response = await fetch("/api/parsing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range: { from: range.from, to: range.to } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.errors?.[0] || "Gmail sync failed");
      ApplicationStore.write({
        applications: result.applications || [],
        lastSync: result.syncedAt || new Date().toISOString(),
        processed: result.processed || 0,
        syncDurationMs: result.syncDurationMs || 0,
        parserVersion: "1.0.0",
      });
      publish({ lastCompletedAt: result.syncedAt || new Date().toISOString() });
    } catch (error) {
      publish({ error: error instanceof Error ? error.message : "Gmail sync failed" });
      throw error;
    } finally {
      publish({ syncing: false });
      activeRequest = null;
    }
  })();

  return activeRequest;
}

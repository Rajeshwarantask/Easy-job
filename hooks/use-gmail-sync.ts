"use client";

import { useSyncExternalStore } from "react";
import { getGmailSyncSnapshot, subscribeToGmailSync, syncGmail, type SyncRange } from "@/lib/sync/gmail-sync-client";

const serverSnapshot = { syncing: false, error: null, lastCompletedAt: null } as const;

export function useGmailSync() {
  const state = useSyncExternalStore(subscribeToGmailSync, getGmailSyncSnapshot, () => serverSnapshot);
  return { ...state, sync: (range: SyncRange) => syncGmail(range) };
}

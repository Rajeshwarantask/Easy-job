
"use client";

import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncStatusBarProps {
  status: SyncStatus;
  lastSynced: Date | null;
  errorMessage?: string | null;
}

export function SyncStatusBar({ status, lastSynced, errorMessage }: SyncStatusBarProps) {
  if (status === "idle" && !lastSynced) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {status === "syncing" && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-muted-foreground">Syncing Gmail...</span>
        </>
      )}
      {status === "success" && lastSynced && (
        <>
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-muted-foreground">
            Synced {formatDistanceToNow(lastSynced, { addSuffix: true })}
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="w-3 h-3 text-destructive" />
          <span className="text-destructive">{errorMessage ?? "Sync failed"}</span>
        </>
      )}
      {status === "idle" && lastSynced && (
        <>
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Last synced {formatDistanceToNow(lastSynced, { addSuffix: true })}</span>
        </>
      )}
    </div>
  );
}

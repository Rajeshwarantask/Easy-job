"use client";

import { useState } from "react";
import { Inbox, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface EmptyStateProps {
  lastSynced: Date | null;
}

export function EmptyState({ lastSynced }: EmptyStateProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json();
      if (data.error) {
        setSyncError(data.error);
      } else {
        window.location.reload();
      }
    } catch (error) {
      setSyncError("Failed to sync. Please check your connection and try again.");
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-4">
      <div className="flex flex-col items-center text-center max-w-md space-y-6">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary">
          <Inbox className="w-8 h-8 text-muted-foreground" />
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            No job applications yet
          </h2>
          <p className="text-muted-foreground text-sm">
            Click "Sync Gmail" to automatically extract job applications from your email inbox. 
            We'll find recruitment messages, offers, rejections, and interview confirmations.
          </p>
          <div className="text-xs text-muted-foreground space-y-2 p-3 bg-secondary/50 rounded-lg">
            <p className="font-medium text-foreground">💡 Tip:</p>
            <p>For large mailboxes, use the <strong>date range filter</strong> in <a href="/settings" className="underline hover:text-foreground">Settings</a> to sync only recent emails and avoid timeouts.</p>
            <p>Options: Past 7 days, 30 days, 90 days, or all time.</p>
          </div>
        </div>

        <Button
          onClick={handleSync}
          disabled={isSyncing}
          className="gap-2 w-full"
          size="lg"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "Sync Gmail"}
        </Button>

        {syncError && (
          <div className="w-full rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive text-left">{syncError}</p>
          </div>
        )}

        {lastSynced && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            Last synced {formatDistanceToNow(lastSynced, { addSuffix: true })}
          </p>
        )}
      </div>
    </div>
  );
}

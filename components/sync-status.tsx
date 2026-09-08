"use client";

import { useState, useEffect } from "react";
import { useGmailSync } from "@/hooks/use-gmail-sync";
import { Loader, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SyncStatusProps {
  onSync?: () => Promise<void>;
}

export function SyncStatus({ onSync }: SyncStatusProps) {
  const { syncing, error: syncError, lastCompletedAt, sync } = useGmailSync();
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const error = syncError;
  const [status, setStatus] = useState<"idle" | "syncing" | "success" | "error">(
    "idle"
  );

  useEffect(() => {
    if (lastCompletedAt) {
      setLastSync(new Date(lastCompletedAt));
      setStatus("success");
    }
    if (syncing) setStatus("syncing");
    if (syncError) setStatus("error");
  }, [lastCompletedAt, syncing, syncError]);

  const handleSync = async () => {
    try {
      await sync({ from: null, to: null, label: "All time" });
      if (onSync) await onSync();
    } catch {
      // Shared sync state exposes the error to every button.
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold flex items-center gap-2">
            Sync Status
            {status === "syncing" && (
              <Loader size={16} className="animate-spin text-blue-400" />
            )}
            {status === "success" && (
              <CheckCircle size={16} className="text-green-400" />
            )}
            {status === "error" && (
              <AlertCircle size={16} className="text-red-400" />
            )}
          </h3>
          {lastSync && (
            <p className="text-xs text-gray-400">
              Last synced: {lastSync.toLocaleTimeString()}
            </p>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-2 hover:bg-gray-800 disabled:opacity-50 rounded transition-colors"
          title="Sync now"
        >
          <RefreshCw
            size={20}
            className={syncing ? "animate-spin text-blue-400" : "text-gray-400"}
          />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-700 rounded text-sm text-red-200">
          {error}
        </div>
      )}

      {status === "success" && (
        <div className="p-3 bg-green-900/20 border border-green-700 rounded text-sm text-green-200">
          Sync completed successfully
        </div>
      )}
    </div>
  );
}

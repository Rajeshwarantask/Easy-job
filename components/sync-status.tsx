"use client";

import { useState, useEffect } from "react";
import { Loader, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SyncStatusProps {
  onSync?: () => Promise<void>;
}

export function SyncStatus({ onSync }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "syncing" | "success" | "error">(
    "idle"
  );

  const handleSync = async () => {
    try {
      setSyncing(true);
      setStatus("syncing");
      setError(null);

      const res = await fetch("/api/parsing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailMessages: [] }),
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      const data = await res.json();
      setLastSync(new Date());
      setStatus("success");

      if (onSync) {
        await onSync();
      }
    } catch (err) {
      console.error("[v0] Sync error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    } finally {
      setSyncing(false);

      // Reset success status after 3 seconds
      setTimeout(() => {
        if (status === "success") {
          setStatus("idle");
        }
      }, 3000);
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

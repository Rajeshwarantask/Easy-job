"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";

interface SyncStage {
  id: string;
  name: string;
  status: "idle" | "active" | "complete" | "error";
  progress: number; // 0-100
}

interface SyncStats {
  total: number;
  processed: number;
  found: number;
  merged: number;
  skipped: number;
  errors: number;
  currentEmail?: {
    company: string;
    role: string;
  };
  elapsedSeconds: number;
  estimatedRemainingSeconds: number;
}

interface SyncProgressPanelProps {
  isOpen: boolean;
  stages: SyncStage[];
  stats: SyncStats;
  overallProgress: number; // 0-100
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
}

export function SyncProgressPanel({
  isOpen,
  stages,
  stats,
  overallProgress,
  isComplete,
  hasError,
  errorMessage,
}: SyncProgressPanelProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    if (displayProgress < overallProgress) {
      const timer = setTimeout(() => {
        setDisplayProgress((prev) => Math.min(prev + 1, overallProgress));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [displayProgress, overallProgress]);

  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b border-border p-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {isComplete && !hasError && (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            )}
            {hasError && <AlertCircle className="w-5 h-5 text-red-500" />}
            {!isComplete && !hasError && (
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            )}
            {isComplete && !hasError ? "Sync Complete" : "Syncing Gmail"}
          </h2>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 border-b border-border">
          <div className="space-y-3">
            {/* Percentage and ETA */}
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{Math.round(displayProgress)}%</span>
              {!isComplete && stats.estimatedRemainingSeconds > 0 && (
                <span className="text-muted-foreground text-xs">
                  ~{formatTime(stats.estimatedRemainingSeconds)} remaining
                </span>
              )}
            </div>

            {/* Animated Progress Bar */}
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>

            {/* Current Stage */}
            {!isComplete && stats.currentEmail && (
              <div className="text-xs text-muted-foreground pt-2">
                <div>
                  <span className="font-medium">{stats.currentEmail.company}</span>
                </div>
                <div className="text-xs">{stats.currentEmail.role}</div>
              </div>
            )}
          </div>
        </div>

        {/* Stages */}
        {stages.length > 0 && (
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              Pipeline Stages
            </h3>
            <div className="space-y-2">
              {stages.map((stage) => (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{stage.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {stage.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          stage.status === "complete"
                            ? "bg-green-500"
                            : stage.status === "active"
                              ? "bg-blue-500"
                              : stage.status === "error"
                                ? "bg-red-500"
                                : "bg-gray-600"
                        }`}
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-5 flex justify-center">
                    {stage.status === "complete" && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                    {stage.status === "active" && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {stage.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
            Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Processed</div>
              <div className="text-lg font-semibold">
                {stats.processed} / {stats.total}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Applications Found</div>
              <div className="text-lg font-semibold text-green-500">{stats.found}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Merged</div>
              <div className="text-lg font-semibold text-blue-500">{stats.merged}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Skipped</div>
              <div className="text-lg font-semibold text-gray-400">{stats.skipped}</div>
            </div>
            {stats.errors > 0 && (
              <div>
                <div className="text-xs text-muted-foreground">Errors</div>
                <div className="text-lg font-semibold text-red-500">{stats.errors}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground">Elapsed</div>
              <div className="text-lg font-semibold">{formatTime(stats.elapsedSeconds)}</div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {hasError && errorMessage && (
          <div className="px-6 py-4 border-b border-border bg-red-900/10 border-red-500/30">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-red-500">Error</h4>
                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Completion Summary */}
        {isComplete && !hasError && (
          <div className="px-6 py-4 bg-green-900/10 border-t border-green-500/30">
            <h3 className="text-sm font-semibold text-green-500 mb-3">
              Sync Completed Successfully
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total Emails</div>
                <div className="text-lg font-semibold">{stats.total}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Applications Found</div>
                <div className="text-lg font-semibold text-green-500">{stats.found}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Merged Updates</div>
                <div className="text-lg font-semibold text-blue-500">{stats.merged}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Time</div>
                <div className="text-lg font-semibold">
                  {formatTime(stats.elapsedSeconds)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

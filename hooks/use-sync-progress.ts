"use client";

import { useState, useCallback } from "react";

interface SyncStage {
  id: string;
  name: string;
  status: "idle" | "active" | "complete" | "error";
  progress: number;
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

interface UseSyncProgressReturn {
  isOpen: boolean;
  stages: SyncStage[];
  stats: SyncStats;
  overallProgress: number;
  isComplete: boolean;
  hasError: boolean;
  errorMessage?: string;
  // Actions
  startSync: () => void;
  endSync: () => void;
  setError: (message: string) => void;
  updateStage: (stageId: string, progress: number, status?: "active" | "complete" | "error") => void;
  updateStats: (stats: Partial<SyncStats>) => void;
  setCurrentEmail: (company: string, role: string) => void;
}

const defaultStages: SyncStage[] = [
  { id: "connect", name: "Connecting to Gmail", status: "idle", progress: 0 },
  { id: "fetch", name: "Fetching Emails", status: "idle", progress: 0 },
  { id: "filter", name: "Filtering Recruitment Emails", status: "idle", progress: 0 },
  { id: "parse", name: "Parsing Applications", status: "idle", progress: 0 },
  { id: "timeline", name: "Building Timeline", status: "idle", progress: 0 },
  { id: "merge", name: "Merging Duplicates", status: "idle", progress: 0 },
];

const defaultStats: SyncStats = {
  total: 0,
  processed: 0,
  found: 0,
  merged: 0,
  skipped: 0,
  errors: 0,
  elapsedSeconds: 0,
  estimatedRemainingSeconds: 0,
};

export function useSyncProgress(): UseSyncProgressReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [stages, setStages] = useState<SyncStage[]>(defaultStages);
  const [stats, setStats] = useState<SyncStats>(defaultStats);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [startTime, setStartTime] = useState<number>(0);

  const startSync = useCallback(() => {
    setIsOpen(true);
    setStages(defaultStages);
    setStats(defaultStats);
    setIsComplete(false);
    setHasError(false);
    setErrorMessage(undefined);
    setStartTime(Date.now());

    // Mark first stage as active
    setStages((prev) =>
      prev.map((s, i) =>
        i === 0 ? { ...s, status: "active" } : s
      )
    );
  }, []);

  const endSync = useCallback(() => {
    setIsComplete(true);
    // Mark all stages as complete
    setStages((prev) =>
      prev.map((s) => ({ ...s, status: "complete", progress: 100 }))
    );
  }, []);

  const updateStage = useCallback(
    (stageId: string, progress: number, status?: "active" | "complete" | "error") => {
      setStages((prev) =>
        prev.map((stage) => {
          if (stage.id === stageId) {
            const newStatus = status || stage.status;
            return { ...stage, progress: Math.min(progress, 100), status: newStatus };
          }
          // If a stage is becoming active, mark previous stages as complete
          if (status === "active" && stage.status === "active") {
            return { ...stage, status: "complete", progress: 100 };
          }
          return stage;
        })
      );

      // Update overall progress
      setStats((prev) => {
        const avgProgress = Math.round(
          stages.reduce((sum, s) => sum + s.progress, 0) / stages.length
        );
        return { ...prev };
      });
    },
    [stages]
  );

  const updateStats = useCallback((newStats: Partial<SyncStats>) => {
    setStats((prev) => {
      const updated = { ...prev, ...newStats };

      // Auto-calculate estimated remaining time
      if (updated.elapsedSeconds > 0 && updated.processed > 0) {
        const emailsPerSecond = updated.processed / updated.elapsedSeconds;
        const remaining = updated.total - updated.processed;
        updated.estimatedRemainingSeconds = Math.ceil(remaining / emailsPerSecond);
      }

      return updated;
    });
  }, []);

  const setCurrentEmail = useCallback((company: string, role: string) => {
    setStats((prev) => ({
      ...prev,
      currentEmail: { company, role },
    }));
  }, []);

  const handleSetError = useCallback((message: string) => {
    setHasError(true);
    setErrorMessage(message);
    setStages((prev) =>
      prev.map((s) => (s.status === "active" ? { ...s, status: "error" } : s))
    );
  }, []);

  // Update elapsed time every second
  const overallProgress = Math.round(
    stages.reduce((sum, s) => sum + s.progress, 0) / stages.length
  );

  return {
    isOpen,
    stages,
    stats: {
      ...stats,
      elapsedSeconds: Math.floor((Date.now() - startTime) / 1000),
    },
    overallProgress,
    isComplete,
    hasError,
    errorMessage,
    startSync,
    endSync,
    setError: handleSetError,
    updateStage,
    updateStats,
    setCurrentEmail,
  };
}

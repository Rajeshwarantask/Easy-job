"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Application, ApplicationStatus } from "@/lib/db-types";
import { ApplicationsTable } from "@/components/applications-table";
import { Loader, RefreshCw, Filter } from "lucide-react";

const CACHE_KEY = "jobtrail:cache";

function readCache() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch {
    return null;
  }
}

function writeCache(data: any) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  // Notify other clients/components
  window.dispatchEvent(new Event("applications-updated"));
}

export default function ApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const status = searchParams.get("status");
  const starred = searchParams.get("starred") === "true";

  // Initialize from sessionStorage only — no network request
  useEffect(() => {
    setLoading(true);
    const cache = readCache();
    if (cache && Array.isArray(cache.applications)) {
      let apps: Application[] = cache.applications;
      // Apply filters if present
      if (status) apps = apps.filter((a) => a.status === status);
      if (starred) apps = apps.filter((a) => a.starred === true);
      setApplications(apps);
      setTotal(cache.applications.length || apps.length);
    } else {
      setApplications([]);
      setTotal(0);
    }
    setLoading(false);

    function onUpdated() {
      const c = readCache();
      if (c && Array.isArray(c.applications)) {
        let apps: Application[] = c.applications;
        if (status) apps = apps.filter((a) => a.status === status);
        if (starred) apps = apps.filter((a) => a.starred === true);
        setApplications(apps);
        setTotal(c.applications.length || apps.length);
      } else {
        setApplications([]);
        setTotal(0);
      }
    }

    window.addEventListener("applications-updated", onUpdated);
    return () => window.removeEventListener("applications-updated", onUpdated);
  }, [status, starred]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch("/api/parsing/sync", { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || result.errors?.[0]?.error || "Sync failed");

      const parsed = Array.isArray(result.applications) ? result.applications : [];

      const cachePayload = {
        version: 1,
        applications: parsed,
        lastSync: new Date().toISOString(),
        processed: result.processed ?? parsed.length,
        syncDurationMs: result.syncDurationMs ?? 0,
      };

      writeCache(cachePayload);

      // Update local view with filters applied
      let appsToShow = parsed;
      if (status) appsToShow = appsToShow.filter((a: any) => a.status === status);
      if (starred) appsToShow = appsToShow.filter((a: any) => a.starred === true);

      setApplications(appsToShow);
      setTotal(parsed.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  // Replace server-side updates with client-only updates: modify sessionStorage and local state
  const persistApplications = (updatedApps: Application[]) => {
    const cache = readCache() || {};
    const newCache = {
      ...(cache || {}),
      version: 1,
      applications: updatedApps,
      lastSync: cache.lastSync || new Date().toISOString(),
      processed: cache.processed ?? updatedApps.length,
      syncDurationMs: cache.syncDurationMs ?? 0,
    };
    writeCache(newCache);
  };

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    try {
      const updated = applications.map((app) => (app.id === id ? { ...app, status: newStatus } : app));
      setApplications(updated);
      // also update full cache (unfiltered)
      const full = (readCache()?.applications || []) as Application[];
      const fullUpdated = full.map((app) => (app.id === id ? { ...app, status: newStatus } : app));
      persistApplications(fullUpdated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleStar = async (id: string, starredFlag: boolean) => {
    try {
      const updated = applications.map((app) => (app.id === id ? { ...app, starred: starredFlag } : app));
      setApplications(updated);
      const full = (readCache()?.applications || []) as Application[];
      const fullUpdated = full.map((app) => (app.id === id ? { ...app, starred: starredFlag } : app));
      persistApplications(fullUpdated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const statuses: ApplicationStatus[] = ["applied", "assessment", "interview", "offer"];
  const statusCounts = statuses.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Job Applications</h1>
            <p className="text-gray-400 mt-1">Track {total} parsed application{total !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg transition-colors"
          >
            {syncing && <Loader size={16} className="animate-spin" />}
            {syncing ? "Syncing..." : "Sync Gmail"}
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-200">{error}</div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => {
                const params = new URLSearchParams();
                if (s !== status) params.set("status", s);
                router.push(`/dashboard/applications?${params.toString()}` || "/dashboard/applications");
              }}
              className={`p-4 rounded-lg border transition-colors ${status === s ? "bg-gray-800 border-blue-500" : "bg-gray-900 border-gray-700 hover:border-gray-600"}`}
            >
              <div className="text-sm text-gray-400 capitalize">{s}</div>
              <div className="text-2xl font-bold mt-1">{statusCounts[s] || 0}</div>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (status) params.set("status", status);
              if (!starred) params.set("starred", "true");
              router.push(`${starred ? "/dashboard/applications" : `/dashboard/applications?${params.toString()}&starred=true`}`);
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${starred ? "bg-gray-800 border-yellow-500" : "bg-gray-900 border-gray-700 hover:border-gray-600"}`}
          >
            <Filter size={16} />
            <span className="text-sm">Starred</span>
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader className="animate-spin" />
          </div>
        ) : (
          <ApplicationsTable applications={applications} onStatusChange={handleStatusChange} onStar={handleStar} />
        )}
      </div>
    </div>
  );
}

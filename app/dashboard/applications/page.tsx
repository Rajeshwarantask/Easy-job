"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Application, ApplicationStatus } from "@/lib/db-types";
import { ApplicationsTable } from "@/components/applications-table";
import { Loader, RefreshCw, Filter } from "lucide-react";

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

  const loadApplications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (starred) params.set("starred", "true");
      params.set("limit", "100");

      const res = await fetch(`/api/applications?${params}`);
      if (!res.ok) throw new Error("Failed to load applications");

      const data = await res.json();
      setApplications(data.applications);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, [status, starred]);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/parsing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Sync failed");

      // Reload applications
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ApplicationStatus) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      // Update local state
      setApplications(
        applications.map((app) =>
          app.id === id ? { ...app, status: newStatus } : app
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleStar = async (id: string, starred: boolean) => {
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      });

      if (!res.ok) throw new Error("Failed to update star");

      // Update local state
      setApplications(
        applications.map((app) =>
          app.id === id ? { ...app, starred } : app
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const statuses: ApplicationStatus[] = [
    "applied",
    "assessment",
    "interview",
    "offer",
  ];
  const statusCounts = statuses.reduce(
    (acc, s) => {
      acc[s] = applications.filter((a) => a.status === s).length;
      return acc;
    },
    {} as Record<ApplicationStatus, number>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Job Applications</h1>
            <p className="text-gray-400 mt-1">
              Track {total} parsed application{total !== 1 ? "s" : ""}
            </p>
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
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => {
                const params = new URLSearchParams();
                if (s !== status) params.set("status", s);
                router.push(
                  `/dashboard/applications?${params.toString()}` || 
                  "/dashboard/applications"
                );
              }}
              className={`p-4 rounded-lg border transition-colors ${
                status === s
                  ? "bg-gray-800 border-blue-500"
                  : "bg-gray-900 border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="text-sm text-gray-400 capitalize">{s}</div>
              <div className="text-2xl font-bold mt-1">
                {statusCounts[s] || 0}
              </div>
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
              router.push(
                `${starred ? "/dashboard/applications" : `/dashboard/applications?${params.toString()}&starred=true`}`
              );
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
              starred
                ? "bg-gray-800 border-yellow-500"
                : "bg-gray-900 border-gray-700 hover:border-gray-600"
            }`}
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
          <ApplicationsTable
            applications={applications}
            onStatusChange={handleStatusChange}
            onStar={handleStar}
          />
        )}
      </div>
    </div>
  );
}

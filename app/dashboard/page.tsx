
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader, TrendingUp, Mail, CheckCircle, Clock, LogOut } from "lucide-react";

interface Stats {
  total: number;
  by_status: Record<string, number>;
  average_confidence: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/applications?limit=100");
      if (!res.ok) throw new Error("Failed to load applications");

      const data = await res.json();
      const apps = data.applications;

      setStats({
        total: data.total,
        by_status: {
          applied: apps.filter((a: any) => a.status === "applied").length,
          assessment: apps.filter((a: any) => a.status === "assessment").length,
          interview: apps.filter((a: any) => a.status === "interview").length,
          offer: apps.filter((a: any) => a.status === "offer").length,
        },
        average_confidence:
          apps.length > 0
            ? apps.reduce((sum: number, a: any) => sum + (a.parser_confidence || 0), 0) /
              apps.length
            : 0,
      });
    } catch (err) {
      console.error("[v0] Error loading stats:", err);
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch("/api/parsing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailMessages: [],
        }),
      });

      if (!res.ok) throw new Error("Sync failed");
      await loadStats();
    } catch (err) {
      console.error("[v0] Sync error:", err);
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } catch (err) {
      console.error("[v0] Logout error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="font-bold text-xl">JobTrail</div>
          <div className="flex gap-6 items-center">
            <Link
              href="/dashboard/applications"
              className="text-gray-300 hover:text-white transition-colors"
            >
              Applications
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-800 rounded transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Welcome to JobTrail</h1>
          <p className="text-gray-400">
            Automatically parse and track job applications from your email
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <button
            onClick={handleSync}
            disabled={syncing || loading}
            className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-800 rounded-lg transition-all text-left"
          >
            <div className="flex items-center gap-3">
              {syncing && <Loader size={20} className="animate-spin" />}
              <Mail size={20} />
              <div>
                <div className="font-semibold">{syncing ? "Syncing..." : "Sync Gmail"}</div>
                <div className="text-sm text-blue-100">
                  Import new job application emails
                </div>
              </div>
            </div>
          </button>

          <Link
            href="/dashboard/applications"
            className="p-6 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 rounded-lg transition-all flex items-center gap-3"
          >
            <CheckCircle size={20} />
            <div>
              <div className="font-semibold">View Applications</div>
              <div className="text-sm text-purple-100">
                Browse all tracked applications
              </div>
            </div>
          </Link>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="animate-spin" />
          </div>
        ) : stats ? (
          <div className="grid md:grid-cols-4 gap-4 mb-16">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Applications</span>
                <TrendingUp size={16} className="text-blue-400" />
              </div>
              <div className="text-3xl font-bold">{stats.total}</div>
              <div className="text-xs text-gray-500 mt-2">Parsed from email</div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-2">Status Breakdown</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Applied</span>
                  <span className="font-semibold">{stats.by_status.applied || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Assessment</span>
                  <span className="font-semibold">{stats.by_status.assessment || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Interview</span>
                  <span className="font-semibold">{stats.by_status.interview || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Offer</span>
                  <span className="font-semibold">{stats.by_status.offer || 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-2">Parser Confidence</div>
              <div className="text-3xl font-bold text-green-400">
                {Math.round(stats.average_confidence * 100)}%
              </div>
              <div className="text-xs text-gray-500 mt-2">Average accuracy</div>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Next Actions</span>
                <Clock size={16} className="text-orange-400" />
              </div>
              <div className="text-2xl font-bold">{stats.by_status.interview || 0}</div>
              <div className="text-xs text-gray-500 mt-2">Interviews scheduled</div>
            </div>
          </div>
        ) : null}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-block p-3 bg-blue-900 rounded-lg mb-4">
              <Mail size={24} className="text-blue-400" />
            </div>
            <h3 className="font-semibold mb-2">Email Parsing</h3>
            <p className="text-gray-400 text-sm">
              Automatically extract job application details from your inbox
            </p>
          </div>

          <div className="text-center">
            <div className="inline-block p-3 bg-purple-900 rounded-lg mb-4">
              <TrendingUp size={24} className="text-purple-400" />
            </div>
            <h3 className="font-semibold mb-2">Track Progress</h3>
            <p className="text-gray-400 text-sm">
              Monitor your applications across multiple platforms
            </p>
          </div>

          <div className="text-center">
            <div className="inline-block p-3 bg-green-900 rounded-lg mb-4">
              <CheckCircle size={24} className="text-green-400" />
            </div>
            <h3 className="font-semibold mb-2">Confidence Scoring</h3>
            <p className="text-gray-400 text-sm">
              See parser confidence and override incorrect data
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

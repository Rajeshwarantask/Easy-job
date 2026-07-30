"use client";

import { useState } from "react";
import { Send, MessageSquare, Award, XCircle, Clock, TrendingUp, BarChart3, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { JobApplication, JobStatus } from "@/lib/types";
import { STATUS_CONFIG } from "@/lib/types";
import { formatDistanceToNow, subDays, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  jobs: JobApplication[];
  lastSynced?: string | null;
}

function FunnelBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground tabular-nums">{count}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DashboardStats({ jobs, lastSynced }: DashboardStatsProps) {
  const [view, setView] = useState<"overview" | "insights">("overview");

  const counts: Record<JobStatus, number> = {
    applied: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0,
  };
  jobs.forEach((j) => { counts[j.status]++; });

  // Insights calculations
  const total = jobs.length;
  const responseRate = total > 0
    ? Math.round(((counts.interview + counts.offer) / total) * 100)
    : 0;
  const offerRate = counts.interview > 0
    ? Math.round((counts.offer / counts.interview) * 100)
    : 0;

  const last7 = jobs.filter((j) =>
    j.applied_date && isAfter(new Date(j.applied_date), subDays(new Date(), 7))
  ).length;
  const last30 = jobs.filter((j) =>
    j.applied_date && isAfter(new Date(j.applied_date), subDays(new Date(), 30))
  ).length;

  const activeCount = counts.applied + counts.interview;
  const mostCommonPlatform = (() => {
    const freq: Record<string, number> = {};
    jobs.forEach((j) => { if (j.platform) freq[j.platform] = (freq[j.platform] ?? 0) + 1; });
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : null;
  })();

  const stats = [
    { label: "Applied", value: counts.applied, icon: Send, color: "text-blue-600", bg: "bg-blue-500/10" },
    { label: "Interview", value: counts.interview, icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-500/10" },
    { label: "Offer", value: counts.offer, icon: Award, color: "text-green-600", bg: "bg-green-500/10" },
    { label: "Rejected", value: counts.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-500/10" },
  ];

  return (
    <div className="space-y-4">
      {/* Page title + tab toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {total} total application{total !== 1 ? "s" : ""}
            {lastSynced && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(lastSynced), { addSuffix: true })}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center rounded-lg border border-border p-0.5 gap-0.5">
          <Button
            variant={view === "overview" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5 px-3"
            onClick={() => setView("overview")}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Overview
          </Button>
          <Button
            variant={view === "insights" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs gap-1.5 px-3"
            onClick={() => setView("insights")}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Insights
          </Button>
        </div>
      </div>

      {view === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4 light:glass light:shadow-sm">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-md", stat.bg, stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground leading-none">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "insights" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Funnel */}
          <Card className="p-4 space-y-3 light:glass light:shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Target className="w-4 h-4 text-muted-foreground" />
              Application funnel
            </div>
            <div className="space-y-2.5">
              <FunnelBar label="Applied" count={counts.applied} max={total} color="bg-blue-500" />
              <FunnelBar label="Interview" count={counts.interview} max={total} color="bg-amber-500" />
              <FunnelBar label="Offer" count={counts.offer} max={total} color="bg-green-500" />
              <FunnelBar label="Rejected" count={counts.rejected} max={total} color="bg-red-400" />
            </div>
          </Card>

          {/* Key metrics */}
          <Card className="p-4 space-y-3 light:glass light:shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              Key metrics
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Response rate</span>
                <span className={cn("font-semibold", responseRate >= 30 ? "text-green-600" : "text-foreground")}>
                  {responseRate}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Offer rate</span>
                <span className={cn("font-semibold", offerRate >= 20 ? "text-green-600" : "text-foreground")}>
                  {offerRate}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active pipelines</span>
                <span className="font-semibold text-foreground">{activeCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This week</span>
                <span className="font-semibold text-foreground">{last7} applied</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This month</span>
                <span className="font-semibold text-foreground">{last30} applied</span>
              </div>
              {mostCommonPlatform && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Top source</span>
                  <span className="font-semibold text-foreground">{mostCommonPlatform}</span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import {
  subDays, isAfter, isBefore, format, differenceInDays, startOfWeek, addDays,
} from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Send, MessageSquare, Award, Target,
  Clock, BarChart3, PieChart as PieIcon, Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSyncJobs } from "@/hooks/use-sync-jobs";
import type { JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<JobStatus, string> = {
  applied: "#3b82f6",
  interview: "#f59e0b",
  offer: "#22c55e",
  rejected: "#ef4444",
  withdrawn: "#6b7280",
};

function StatCard({
  label, value, sub, icon: Icon, trend, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card className="p-4 light:glass light:shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-semibold", color ?? "text-foreground")}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("p-2 rounded-md bg-secondary", color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs mt-2",
          trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
        )}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
        </div>
      )}
    </Card>
  );
}

export function InsightsClient() {
  const { jobs } = useSyncJobs();

  const stats = useMemo(() => {
    const now = new Date();
    const total = jobs.length;

    const counts = { applied: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0 } as Record<JobStatus, number>;
    jobs.forEach((j) => counts[j.status]++);

    const responseRate = total > 0
      ? Math.round(((counts.interview + counts.offer) / total) * 100)
      : 0;
    const offerRate = counts.interview > 0
      ? Math.round((counts.offer / counts.interview) * 100)
      : 0;
    const last7 = jobs.filter((j) =>
      j.applied_date && isAfter(new Date(j.applied_date), subDays(now, 7))
    ).length;
    const last30 = jobs.filter((j) =>
      j.applied_date && isAfter(new Date(j.applied_date), subDays(now, 30))
    ).length;
    const prev30 = jobs.filter((j) =>
      j.applied_date &&
      isAfter(new Date(j.applied_date), subDays(now, 60)) &&
      isBefore(new Date(j.applied_date), subDays(now, 30))
    ).length;

    // Weekly activity for last 8 weeks
    const weeklyData = Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subDays(now, (7 - i) * 7), { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const count = jobs.filter((j) => {
        if (!j.applied_date) return false;
        const d = new Date(j.applied_date);
        return isAfter(d, weekStart) && isBefore(d, weekEnd);
      }).length;
      return { week: format(weekStart, "MMM d"), count };
    });

    // Platform breakdown
    const platformMap: Record<string, number> = {};
    jobs.forEach((j) => {
      const p = j.platform ?? "Unknown";
      platformMap[p] = (platformMap[p] ?? 0) + 1;
    });
    const platformData = Object.entries(platformMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    // Status distribution
    const statusData = (Object.keys(counts) as JobStatus[])
      .filter((k) => counts[k] > 0)
      .map((k) => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: counts[k], color: STATUS_COLORS[k] }));

    // Avg response time (applied → interview)
    const interviewJobs = jobs.filter((j) =>
      (j.status === "interview" || j.status === "offer") && j.applied_date && j.last_activity
    );
    const avgResponse = interviewJobs.length > 0
      ? Math.round(
          interviewJobs.reduce((sum, j) => {
            return sum + differenceInDays(new Date(j.last_activity!), new Date(j.applied_date!));
          }, 0) / interviewJobs.length
        )
      : null;

    return {
      total, counts, responseRate, offerRate, last7, last30, prev30,
      weeklyData, platformData, statusData, avgResponse,
    };
  }, [jobs]);

  const platformColors = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="py-6 px-4 lg:px-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Analytics across {stats.total} application{stats.total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Response rate"
          value={`${stats.responseRate}%`}
          sub="Applications → Interview"
          icon={MessageSquare}
          color={stats.responseRate >= 30 ? "text-green-500" : undefined}
        />
        <StatCard
          label="Offer rate"
          value={`${stats.offerRate}%`}
          sub="Interviews → Offer"
          icon={Award}
          color={stats.offerRate >= 20 ? "text-green-500" : undefined}
        />
        <StatCard
          label="Applied this month"
          value={stats.last30}
          sub={stats.prev30 > 0 ? `vs ${stats.prev30} last month` : "last 30 days"}
          icon={Send}
          trend={stats.last30 >= stats.prev30 ? "up" : "down"}
        />
        <StatCard
          label="Avg response time"
          value={stats.avgResponse !== null ? `${stats.avgResponse}d` : "—"}
          sub="Applied to first reply"
          icon={Clock}
        />
      </div>

      {/* Weekly activity + status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Weekly applications</h2>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.weeklyData} barSize={20}>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "var(--foreground)",
                }}
                cursor={{ fill: "var(--accent)" }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Status breakdown</h2>
          </div>
          {stats.statusData.length === 0 ? (
            <div className="flex items-center justify-center h-[180px] text-sm text-muted-foreground">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={stats.statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={40}
                  paddingAngle={2}
                >
                  {stats.statusData.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[(entry.name.toLowerCase() as JobStatus)] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--foreground)",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Source platform + conversion funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Top platforms</h2>
          </div>
          {stats.platformData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No platform data yet</p>
          ) : (
            <div className="space-y-2.5">
              {stats.platformData.map((p, i) => {
                const pct = stats.total > 0 ? Math.round((p.value / stats.total) * 100) : 0;
                return (
                  <div key={p.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">{p.name}</span>
                      <span className="text-muted-foreground tabular-nums">{p.value} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: platformColors[i % platformColors.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Conversion funnel</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Applications sent", count: stats.total, color: "bg-blue-500" },
              { label: "Got interviews", count: stats.counts.interview + stats.counts.offer, color: "bg-amber-500" },
              { label: "Received offers", count: stats.counts.offer, color: "bg-green-500" },
            ].map((step, i) => {
              const pct = stats.total > 0 ? Math.round((step.count / stats.total) * 100) : 0;
              const widths = ["100%", `${Math.max(pct, 4)}%`, `${Math.max(pct, 2)}%`];
              return (
                <div key={step.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">{step.count}</span>
                  </div>
                  <div className="h-6 rounded-md bg-secondary overflow-hidden">
                    <div
                      className={cn("h-full rounded-md flex items-center px-2 transition-all duration-700", step.color)}
                      style={{ width: widths[i] }}
                    >
                      {step.count > 0 && (
                        <span className="text-[10px] text-white font-medium">{pct}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

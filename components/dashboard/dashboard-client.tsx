"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Mail, RefreshCw, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import type { ParsedApplication, ApplicationStatus } from "@/lib/types";

const CACHE_KEY = "jobtrail:cache";
const statusLabel: Record<ApplicationStatus, string> = { applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
const statusVariant: Record<ApplicationStatus, "default" | "secondary" | "outline" | "destructive"> = { applied: "secondary", assessment: "outline", interview: "default", offer: "default", rejected: "destructive", withdrawn: "outline" };

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}

export function DashboardClient() {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCache = () => {
    const cache = readCache();
    setApplications(Array.isArray(cache?.applications) ? cache.applications : []);
    setLastSynced(cache?.lastSync ? new Date(cache.lastSync) : null);
  };

  useEffect(() => { loadCache(); window.addEventListener("applications-updated", loadCache); return () => window.removeEventListener("applications-updated", loadCache); }, []);

  const handleSync = async () => {
    setSyncing(true); setError(null);
    try {
      const response = await fetch("/api/parsing/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.errors?.[0]?.error || "Sync failed");
      const syncedAt = new Date().toISOString();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ version: 1, applications: result.applications || [], lastSync: syncedAt, parserVersion: "1.0.0", syncDurationMs: result.syncDurationMs || 0 }));
      window.dispatchEvent(new Event("applications-updated"));
    } catch (value) { setError(value instanceof Error ? value.message : "Sync failed"); }
    finally { setSyncing(false); }
  };

  const metrics = useMemo(() => ({
    active: applications.filter((app) => !["rejected", "withdrawn"].includes(app.status)).length,
    interviews: applications.filter((app) => app.status === "interview").length,
    offers: applications.filter((app) => app.status === "offer").length,
    companies: new Set(applications.map((app) => app.company).filter(Boolean)).size,
  }), [applications]);
  const upcoming = applications.filter((app) => app.interviewDate).sort((a, b) => String(a.interviewDate).localeCompare(String(b.interviewDate))).slice(0, 3);
  const recent = applications.slice().sort((a, b) => String(b.lastUpdated || b.appliedDate).localeCompare(String(a.lastUpdated || a.appliedDate))).slice(0, 5);

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10">
    <header className="flex flex-col justify-between gap-5 border-b border-border pb-7 sm:flex-row sm:items-end">
      <div><p className="text-sm font-medium text-muted-foreground">Workspace overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Good morning. Here&apos;s your search.</h1><p className="mt-2 text-sm text-muted-foreground">A focused view of applications parsed from Gmail.</p></div>
      <Button onClick={handleSync} disabled={syncing}><RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : undefined} />{syncing ? "Syncing Gmail" : "Sync Gmail"}</Button>
    </header>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[{ label: "Active applications", value: metrics.active, icon: TrendingUp }, { label: "Interviews", value: metrics.interviews, icon: CalendarDays }, { label: "Offers", value: metrics.offers, icon: CheckCircle2 }, { label: "Companies", value: metrics.companies, icon: Mail }].map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><Icon className="size-5 text-muted-foreground" /></CardContent></Card>)}
    </section>
    {lastSynced && <SyncStatusBar status={syncing ? "syncing" : "success"} lastSynced={lastSynced} />}
    {applications.length === 0 ? <Empty className="border border-dashed py-20"><Mail className="size-8 text-muted-foreground" /><h2 className="text-xl font-semibold">Your workspace is ready</h2><p className="max-w-md text-sm text-muted-foreground">Sync Gmail to turn recruitment emails into a clear application timeline. Nothing is stored on the server.</p><Button onClick={handleSync}>Sync your inbox</Button></Empty> : <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Recent applications</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/dashboard/applications">View all <ArrowUpRight data-icon="inline-end" /></Link></Button></CardHeader><CardContent className="p-0">{recent.map((app) => <Link key={app.id} href={`/dashboard/applications/${app.id}`} className="flex items-center justify-between gap-4 border-t px-6 py-4 transition-colors hover:bg-muted/40"><div className="min-w-0"><p className="truncate font-medium">{app.role || "Untitled role"}</p><p className="truncate text-sm text-muted-foreground">{app.company || "Unknown company"}</p></div><Badge variant={statusVariant[app.status]}>{statusLabel[app.status]}</Badge></Link>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Next up</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{upcoming.length ? upcoming.map((app) => <Link key={app.id} href={`/dashboard/applications/${app.id}`} className="flex gap-3 rounded-md border p-3 hover:bg-muted/40"><Clock3 className="mt-0.5 size-4 text-muted-foreground" /><div><p className="font-medium">{app.role || "Interview"}</p><p className="text-sm text-muted-foreground">{app.company} · {app.interviewDate}</p></div></Link>) : <p className="text-sm text-muted-foreground">No upcoming interviews parsed yet.</p>}</CardContent></Card>
    </div>}
  </div>;
}

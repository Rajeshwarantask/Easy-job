"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Mail, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { SyncStatusBar } from "@/components/dashboard/sync-status-bar";
import { DateRangeFilter, type DateRangeValue } from "@/components/dashboard/date-range-filter";
import { ApplicationStore } from "@/lib/store/application-store";
import { useGmailSync } from "@/hooks/use-gmail-sync";
import { formatSyncDate } from "@/lib/sync/gmail-sync-client";
import { getApplicationId } from "@/lib/parsing/application-accessors";
import type { ApplicationStatus, ParsedApplication } from "@/lib/types";

const statusLabel: Record<ApplicationStatus, string> = { applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
const statusVariant: Record<ApplicationStatus, "default" | "secondary" | "outline" | "destructive"> = { applied: "secondary", assessment: "outline", interview: "default", offer: "default", rejected: "destructive", withdrawn: "outline" };

function applicationDate(app: ParsedApplication) {
  const value = app.appliedDate || app.lastUpdated;
  return value ? new Date(value) : null;
}

function inRange(app: ParsedApplication, range: DateRangeValue) {
  const date = applicationDate(app);
  if (!date || (range.from && date < range.from) || (range.to && date > range.to)) return false;
  return true;
}

export default function DashboardPage() {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null, label: "All time" });
  const { syncing, error, sync } = useGmailSync();

  useEffect(() => ApplicationStore.subscribe((snapshot) => { setApplications(snapshot.applications); setLastSynced(snapshot.lastSync ? new Date(snapshot.lastSync) : null); }), []);

  const handleSync = () => sync({ from: formatSyncDate(range.from), to: formatSyncDate(range.to), label: range.label });

  const filtered = useMemo(() => applications.filter((app) => inRange(app, range)), [applications, range]);
  const metrics = useMemo(() => ({ active: filtered.filter((app) => !["rejected", "withdrawn"].includes(app.status)).length, interviews: filtered.filter((app) => app.status === "interview").length, offers: filtered.filter((app) => app.status === "offer").length, companies: new Set(filtered.map((app) => app.company).filter(Boolean)).size }), [filtered]);
  const recent = filtered.slice().sort((a, b) => String(b.lastUpdated || b.appliedDate).localeCompare(String(a.lastUpdated || a.appliedDate))).slice(0, 5);
  const upcoming = filtered.filter((app) => app.interviewDate).slice(0, 3);

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-6 py-8 lg:px-10">
    <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-muted-foreground">Workspace overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Your job search at a glance</h1><p className="mt-2 text-sm text-muted-foreground">Applications parsed from Gmail, organized for the next action.</p></div><div className="flex flex-wrap items-center gap-2"><DateRangeFilter value={range} onChange={setRange} /><Button onClick={handleSync} disabled={syncing}><RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : undefined} />{syncing ? "Syncing Gmail" : "Sync Gmail"}</Button></div></header>
    {range.label !== "All time" && <p className="-mt-3 text-sm text-muted-foreground">Showing applications from <span className="font-medium text-foreground">{range.label.toLowerCase()}</span>.</p>}
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <section aria-label="Application summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Active applications", metrics.active, TrendingUp], ["Interviews", metrics.interviews, CalendarDays], ["Offers", metrics.offers, CheckCircle2], ["Companies", metrics.companies, Mail]].map(([label, value, Icon]) => <Card key={String(label)}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label as string}</p><p className="mt-2 text-3xl font-semibold">{value as number}</p></div><Icon className="size-5 text-muted-foreground" /></CardContent></Card>)}</section>
    {lastSynced && <SyncStatusBar status={syncing ? "syncing" : "success"} lastSynced={lastSynced} />}
    {applications.length === 0 ? <Empty className="border border-dashed py-16"><Mail className="size-8 text-muted-foreground" /><h2 className="text-xl font-semibold">No applications yet</h2><p className="max-w-md text-sm text-muted-foreground">Sync Gmail to turn recruitment emails into your application tracker.</p><Button onClick={handleSync}>Sync Gmail</Button></Empty> : filtered.length === 0 ? <Empty className="border border-dashed py-16"><CalendarDays className="size-8 text-muted-foreground" /><h2 className="text-xl font-semibold">No applications in this range</h2><p className="text-sm text-muted-foreground">Try another range or clear the filter.</p><Button variant="outline" onClick={() => setRange({ from: null, to: null, label: "All time" })}>Show all applications</Button></Empty> : <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]"><Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>Recent applications</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/dashboard/applications">View all <ArrowUpRight data-icon="inline-end" /></Link></Button></CardHeader><CardContent className="p-0">{recent.map((app) => { const id = getApplicationId(app); return <Link key={id} href={`/dashboard/applications/${encodeURIComponent(id)}`} className="flex items-center justify-between gap-4 border-t px-6 py-4 transition-colors hover:bg-muted/40"><div className="min-w-0"><p className="truncate font-medium">{app.role || "Untitled role"}</p><p className="truncate text-sm text-muted-foreground">{app.company || "Unknown company"}</p></div><Badge variant={statusVariant[app.status]}>{statusLabel[app.status]}</Badge></Link>; })}</CardContent></Card><Card><CardHeader><CardTitle>Next up</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{upcoming.length ? upcoming.map((app) => <Link key={getApplicationId(app)} href={`/dashboard/applications/${encodeURIComponent(getApplicationId(app))}`} className="flex gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"><Clock3 className="mt-0.5 size-4 text-muted-foreground" /><div><p className="font-medium">{app.role || "Interview"}</p><p className="text-sm text-muted-foreground">{app.company || "Company"} · {app.interviewDate}</p></div></Link>) : <p className="text-sm text-muted-foreground">No upcoming interviews in this range.</p>}</CardContent></Card></div>}
  </div>;
}

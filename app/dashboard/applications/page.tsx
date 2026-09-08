"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import type { ParsedApplication, ApplicationStatus } from "@/lib/types";
import { getApplicationId } from "@/lib/parsing/application-accessors";
import { ApplicationStore } from "@/lib/store/application-store";

const CACHE_KEY = "jobtrail:cache";
const statuses: ApplicationStatus[] = ["applied", "assessment", "interview", "offer", "rejected", "withdrawn"];
const labels: Record<ApplicationStatus, string> = { applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
const variants: Record<ApplicationStatus, "default" | "secondary" | "outline" | "destructive"> = { applied: "secondary", assessment: "outline", interview: "default", offer: "default", rejected: "destructive", withdrawn: "outline" };

function readCache() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); } catch { return null; } }

export default function ApplicationsPage() {
  const router = useRouter(); const params = useSearchParams();
  const [applications, setApplications] = useState<ParsedApplication[]>([]); const [query, setQuery] = useState(""); const [syncing, setSyncing] = useState(false); const [error, setError] = useState<string | null>(null);
  const selectedStatus = params.get("status") as ApplicationStatus | null;
  const load = () => setApplications(readCache()?.applications || []);
  useEffect(() => { load(); window.addEventListener("applications-updated", load); return () => window.removeEventListener("applications-updated", load); }, []);
  const sync = async () => { setSyncing(true); setError(null); try { const res = await fetch("/api/parsing/sync", { method: "POST" }); const result = await res.json(); if (!res.ok) throw new Error(result.error || "Sync failed"); ApplicationStore.write({ version: 1, applications: result.applications || [], lastSync: new Date().toISOString(), parserVersion: "1.0.0", processed: result.processed || 0, syncDurationMs: result.syncDurationMs || 0 }); window.dispatchEvent(new Event("applications-updated")); } catch (value) { setError(value instanceof Error ? value.message : "Sync failed"); } finally { setSyncing(false); } };
  const filtered = useMemo(() => applications.filter((app) => { const matchesStatus = !selectedStatus || app.status === selectedStatus; const haystack = `${app.company} ${app.role} ${app.location}`.toLowerCase(); return matchesStatus && haystack.includes(query.toLowerCase()); }), [applications, query, selectedStatus]);
  const setStatus = (status?: ApplicationStatus) => { const next = new URLSearchParams(params.toString()); if (status) next.set("status", status); else next.delete("status"); router.push(`/dashboard/applications${next.toString() ? `?${next}` : ""}`); };

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-6 py-8 lg:px-10">
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Applications</h1><p className="mt-2 text-sm text-muted-foreground">{filtered.length} of {applications.length} applications</p></div><Button onClick={sync} disabled={syncing}><RefreshCw data-icon="inline-start" className={syncing ? "animate-spin" : undefined} />{syncing ? "Syncing" : "Sync Gmail"}</Button></header>
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-md flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or role" className="pl-9" /></div><div className="flex flex-wrap gap-2"><Button variant={!selectedStatus ? "secondary" : "outline"} size="sm" onClick={() => setStatus()}>All</Button>{statuses.map((status) => <Button key={status} variant={selectedStatus === status ? "secondary" : "outline"} size="sm" onClick={() => setStatus(status)}>{labels[status]}</Button>)}</div></div>
    {filtered.length === 0 ? <Empty className="border border-dashed py-20"><Filter className="size-8 text-muted-foreground" /><h2 className="text-xl font-semibold">No matching applications</h2><p className="text-sm text-muted-foreground">Try a different search or sync Gmail to refresh your workspace.</p></Empty> : <Card><CardContent className="p-0">{filtered.map((app) => <Link key={getApplicationId(app)} href={`/dashboard/applications/${encodeURIComponent(getApplicationId(app))}`} className="flex flex-col gap-3 border-b p-5 transition-colors last:border-b-0 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-3"><h2 className="truncate font-medium">{app.role || "Untitled role"}</h2><Badge variant={variants[app.status]}>{labels[app.status]}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{app.company || "Unknown company"}{app.location ? ` · ${app.location}` : ""}</p></div><div className="text-left text-sm text-muted-foreground sm:text-right"><p>{app.appliedDate ? `Applied ${app.appliedDate}` : "Date unavailable"}</p><p className="mt-1 text-xs">{app.platform || "Gmail parser"}</p></div></Link>)}</CardContent></Card>}
  </div>;
}

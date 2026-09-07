"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ApplicationStore } from "@/lib/store/application-store";
import { getApplicationId } from "@/lib/parsing/application-accessors";
import type { ApplicationStatus, ParsedApplication } from "@/lib/types";

const terminalStatuses: ApplicationStatus[] = ["rejected", "withdrawn"];
const statusLabel: Record<ApplicationStatus, string> = { applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };

function keyFor(company: string) { return company.trim().toLowerCase(); }
function percent(value: number, total: number) { return total ? `${Math.round((value / total) * 100)}%` : "0%"; }

export default function CompaniesPage() {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  useEffect(() => ApplicationStore.subscribe((snapshot) => setApplications(snapshot.applications)), []);
  const companies = useMemo(() => Array.from(applications.reduce((groups, app) => { const name = app.company || "Unknown company"; const current = groups.get(keyFor(name)) || { name, apps: [] as ParsedApplication[] }; current.apps.push(app); groups.set(keyFor(name), current); return groups; }, new Map<string, { name: string; apps: ParsedApplication[] }>())).sort((a, b) => b[1].apps.length - a[1].apps.length), [applications]);

  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-6 py-8 lg:px-10"><header className="border-b border-border pb-6"><p className="text-sm text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Companies</h1><p className="mt-2 text-sm text-muted-foreground">{companies.length} companies across your parsed applications.</p></header>{companies.length === 0 ? <Empty className="border border-dashed py-16"><Building2 className="size-8 text-muted-foreground" /><h2 className="text-xl font-semibold">No companies yet</h2><p className="text-sm text-muted-foreground">Sync Gmail to group applications by company.</p></Empty> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map(([companyKey, group]) => { const apps = group.apps.slice().sort((a, b) => String(b.lastUpdated || b.appliedDate).localeCompare(String(a.lastUpdated || a.appliedDate))); const active = apps.filter((app) => !terminalStatuses.includes(app.status)).length; const interviews = apps.filter((app) => app.status === "interview").length; const rejected = apps.filter((app) => app.status === "rejected").length; return <Card key={companyKey}><CardHeader className="flex flex-row items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"><Building2 className="size-5 text-muted-foreground" /></div><div className="min-w-0"><CardTitle className="truncate text-base">{group.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{apps.length} role{apps.length !== 1 ? "s" : ""}</p></div></div><Badge variant="secondary">{active} active</Badge></CardHeader><CardContent className="flex flex-col gap-4"><div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{apps.length}</p><p className="text-xs text-muted-foreground">Total</p></div><div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{interviews}</p><p className="text-xs text-muted-foreground">Interviews</p></div><div className="rounded-md bg-muted/50 px-2 py-2"><p className="text-lg font-semibold">{percent(rejected, apps.length)}</p><p className="text-xs text-muted-foreground">Rejected</p></div></div><div className="flex flex-col gap-2">{apps.slice(0, 3).map((app) => <Link key={getApplicationId(app)} href={`/dashboard/applications/${encodeURIComponent(getApplicationId(app))}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"><span className="truncate">{app.role || "Untitled role"}</span><Badge variant="outline">{statusLabel[app.status]}</Badge></Link>)}</div>{apps.length > 3 && <Button asChild variant="outline" className="w-full"><Link href={`/dashboard/companies/${encodeURIComponent(companyKey)}`}>Show all {apps.length} roles <ChevronRight data-icon="inline-end" /></Link></Button>}{apps.length <= 3 && <Button asChild variant="ghost" className="w-full"><Link href={`/dashboard/companies/${encodeURIComponent(companyKey)}`}>View company details <ExternalLink data-icon="inline-end" /></Link></Button>}</CardContent></Card>; })}</div>}</div>;
}

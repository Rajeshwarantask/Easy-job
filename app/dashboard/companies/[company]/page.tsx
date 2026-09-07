"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ApplicationStore } from "@/lib/store/application-store";
import { getApplicationId } from "@/lib/parsing/application-accessors";
import type { ApplicationStatus, ParsedApplication } from "@/lib/types";

const terminalStatuses: ApplicationStatus[] = ["rejected", "withdrawn"];
const statusLabel: Record<ApplicationStatus, string> = { applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
function pct(value: number, total: number) { return total ? `${Math.round((value / total) * 100)}%` : "0%"; }

export default function CompanyDetailPage({ params }: { params: { company: string } }) {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  useEffect(() => ApplicationStore.subscribe((snapshot) => setApplications(snapshot.applications)), []);
  const companyName = decodeURIComponent(params.company);
  const apps = useMemo(() => applications.filter((app) => (app.company || "Unknown company").trim().toLowerCase() === companyName.toLowerCase()).sort((a, b) => String(b.lastUpdated || b.appliedDate).localeCompare(String(a.lastUpdated || a.appliedDate))), [applications, companyName]);
  const stats = useMemo(() => ({ total: apps.length, active: apps.filter((app) => !terminalStatuses.includes(app.status)).length, rejected: apps.filter((app) => app.status === "rejected").length, interviews: apps.filter((app) => app.status === "interview").length, offers: apps.filter((app) => app.status === "offer").length }), [apps]);

  if (!apps.length) return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 lg:px-10"><Button asChild variant="ghost" className="w-fit"><Link href="/dashboard/companies"><ArrowLeft data-icon="inline-start" />Back to companies</Link></Button><Empty className="border border-dashed py-16"><Building2 className="size-8 text-muted-foreground" /><h1 className="text-xl font-semibold">Company not found</h1><p className="text-sm text-muted-foreground">This company is not available in the current session cache.</p></Empty></div>;

  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 py-8 lg:px-10"><Button asChild variant="ghost" className="w-fit"><Link href="/dashboard/companies"><ArrowLeft data-icon="inline-start" />Back to companies</Link></Button><header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="size-4" />Company overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{apps[0].company || companyName}</h1><p className="mt-2 text-sm text-muted-foreground">Full application performance and role history.</p></div><Badge variant="secondary">{stats.active} active roles</Badge></header><section aria-label="Company metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Total roles", stats.total, CircleDot], ["Ongoing", stats.active, CircleDot], ["Interviews", stats.interviews, CalendarDays], ["Offers", stats.offers, CheckCircle2], ["Rejected rate", pct(stats.rejected, stats.total), XCircle]].map(([label, value, Icon]) => <Card key={String(label)}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label as string}</p><p className="mt-2 text-2xl font-semibold">{value as string | number}</p></div><Icon className="size-5 text-muted-foreground" /></CardContent></Card>)}</section><Card><CardHeader><CardTitle>All roles</CardTitle></CardHeader><CardContent className="p-0">{apps.map((app) => <Link key={getApplicationId(app)} href={`/dashboard/applications/${encodeURIComponent(getApplicationId(app))}`} className="flex flex-col gap-3 border-t px-6 py-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="font-medium">{app.role || "Untitled role"}</p><p className="mt-1 text-sm text-muted-foreground">{[app.location, app.platform, app.appliedDate ? `Applied ${app.appliedDate}` : null].filter(Boolean).join(" · ") || "Application details parsed from Gmail"}</p></div><div className="flex items-center gap-3"><Badge variant="outline">{statusLabel[app.status]}</Badge>{app.interviewDate && <span className="text-sm text-muted-foreground">Interview {app.interviewDate}</span>}</div></Link>)}</CardContent></Card></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ParsedApplication } from "@/lib/types";

export default function CompaniesPage() {
  const [applications, setApplications] = useState<ParsedApplication[]>([]);
  useEffect(() => { try { setApplications(JSON.parse(sessionStorage.getItem("jobtrail:cache") || "{}").applications || []); } catch {} }, []);
  const companies = useMemo(() => Array.from(applications.reduce((groups, app) => { const name = app.company || "Unknown company"; const current = groups.get(name) || []; groups.set(name, [...current, app]); return groups; }, new Map<string, ParsedApplication[]>())).sort((a, b) => b[1].length - a[1].length), [applications]);
  return <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 px-6 py-8 lg:px-10"><header className="border-b border-border pb-6"><p className="text-sm text-muted-foreground">Workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Companies</h1><p className="mt-2 text-sm text-muted-foreground">{companies.length} companies across your parsed applications.</p></header><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{companies.map(([company, apps]) => { const active = apps.filter((app) => !["rejected", "withdrawn"].includes(app.status)).length; return <Card key={company}><CardHeader className="flex flex-row items-start justify-between gap-4"><div className="flex min-w-0 gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted"><Building2 className="size-5 text-muted-foreground" /></div><div className="min-w-0"><CardTitle className="truncate text-base">{company}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{apps.length} role{apps.length !== 1 ? "s" : ""}</p></div></div><Badge variant="secondary">{active} active</Badge></CardHeader><CardContent className="flex flex-col gap-2">{apps.slice(0, 3).map((app) => <Link key={app.id} href={`/dashboard/applications/${app.id}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/40"><span className="truncate">{app.role || "Untitled role"}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Link>)}</CardContent></Card>; })}</div></div>;
}

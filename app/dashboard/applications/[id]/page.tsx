"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Edit2, Loader } from "lucide-react";
import { FieldOverrideModal } from "@/components/field-override-modal";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ParsedApplication, TimelineEvent } from "@/lib/parsing/types";
import ApplicationStore from "@/lib/store/application-store";
import { getApplicationId, getCompany, getRole, getLocation, getWorkMode, getParsingPlatform, getParserConfidence, getJobUrl, getStatus } from "@/lib/parsing/application-accessors";

function valueOf(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return valueOf(record.brief ?? record.description ?? record.title ?? record.name ?? record.value ?? "");
  }
  return "";
}

function formatDate(value: unknown): string {
  const text = valueOf(value);
  if (!text) return "Not available";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function label(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function emailRecord(application: ParsedApplication) {
  const record = application as unknown as Record<string, unknown>;
  const email = record.originalEmail as Record<string, unknown> | undefined;
  return email && typeof email === "object" ? email : undefined;
}

function readableDetails(details: unknown): string {
  if (!details || typeof details !== "object") return valueOf(details);
  const record = details as Record<string, unknown>;
  return valueOf(record.brief ?? record.description ?? record.summary ?? record.assessmentType ?? record.rejectionReason ?? record.interviewerName ?? "");
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [application, setApplication] = useState<ParsedApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [overridingField, setOverridingField] = useState<string | null>(null);

  useEffect(() => {
    const find = (apps: ParsedApplication[]) => apps.find((app) => getApplicationId(app) === decodeURIComponent(id) || String((app as Record<string, unknown>).id ?? "") === decodeURIComponent(id)) ?? null;
    const initial = find(ApplicationStore.read().applications);
    setApplication(initial);
    setNotes(valueOf((initial as Record<string, unknown> | null)?.notes));
    setLoading(false);
    return ApplicationStore.subscribe((snapshot) => {
      const next = find(snapshot.applications);
      setApplication(next);
      setNotes(valueOf((next as Record<string, unknown> | null)?.notes));
    });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader className="animate-spin" /></div>;
  if (!application) return <main className="min-h-screen bg-background p-8 text-center text-muted-foreground">Application not found</main>;

  const email = emailRecord(application);
  const appRecord = application as unknown as Record<string, unknown>;
  const timeline = Array.isArray(appRecord.timelineEvents) ? appRecord.timelineEvents as TimelineEvent[] : [];
  const body = valueOf(email?.bodyText ?? email?.plaintext ?? email?.body ?? appRecord.bodyText ?? appRecord.emailBody);
  const company = getCompany(application) || "Company not identified";
  const role = getRole(application) || "Role not identified";
  const status = getStatus(application) || "applied";
  const appliedDate = appRecord.appliedDate ?? email?.date ?? appRecord.extractedAt;
  const platform = getParsingPlatform(application) || "Email";
  const confidence = getParserConfidence(application) ?? 0;
  const jobUrl = getJobUrl(application);
  const location = getLocation(application);
  const workMode = getWorkMode(application);
  const setOverride = (field: string, value: unknown) => { ApplicationStore.update(decodeURIComponent(id), { [field]: value } as Partial<ParsedApplication>); setOverridingField(null); };

  return <main className="min-h-screen bg-background"><div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
    <Link href="/dashboard/applications" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Back to applications</Link>
    <section className="mb-6 rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Application review</p><h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{role}</h1><p className="mt-2 text-xl text-muted-foreground">{company}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-primary/15 px-3 py-1.5 text-sm font-medium capitalize text-primary">{label(status)}</span><ConfidenceBadge confidence={confidence} size="lg" showLabel /></div></div>
      <div className="mt-7 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-5">{[["Date applied", formatDate(appliedDate)], ["Source", label(platform)], ["Location", valueOf(location) || "Not available"], ["Work mode", valueOf(workMode) || "Not available"], ["Message ID", valueOf(email?.gmailMessageId ?? application.id) || "Not available"]].map(([heading, value]) => <div key={heading}><p className="text-xs uppercase tracking-wide text-muted-foreground">{heading}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p></div>)}</div>
    </section>
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Application information</h2><button onClick={() => setOverridingField("status")} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit status"><Edit2 size={16} /></button></div><div className="grid gap-4 sm:grid-cols-2">{[["Status", label(status)], ["Platform", label(platform)], ["Location", valueOf(location) || "Not available"], ["Job URL", jobUrl ? "View posting" : "Not available"]].map(([heading, value]) => <div key={heading} className="rounded-lg border border-border/70 p-4"><p className="text-xs uppercase tracking-wide text-muted-foreground">{heading}</p>{heading === "Job URL" && jobUrl ? <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm text-primary hover:underline">{value}<ExternalLink size={14} /></a> : <p className="mt-1 text-sm font-medium">{value}</p>}</div>)}</div></section>
        <section className="rounded-2xl border border-border bg-card p-6"><h2 className="mb-5 text-lg font-semibold">Original email</h2>{email ? <div className="space-y-4"><div className="grid gap-3 border-b border-border pb-4 sm:grid-cols-3"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p><p className="mt-1 text-sm font-medium">{valueOf(email.subject) || "No subject"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Sender</p><p className="mt-1 break-all text-sm">{valueOf(email.from) || "Unknown sender"}</p></div><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p><p className="mt-1 text-sm">{formatDate(email.date ?? email.internalDate)}</p></div></div><pre className="max-h-[30rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-4 font-sans text-sm leading-6 text-foreground">{body || "Email body is not available in this cached record."}</pre></div> : <p className="text-sm text-muted-foreground">Original email content is not available in this cached record.</p>}</section>
        <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Notes</h2><button onClick={() => setEditing(!editing)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Edit notes"><Edit2 size={16} /></button></div>{editing ? <div><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm" placeholder="Add notes about this application..." /><div className="mt-3 flex gap-2"><button onClick={() => { ApplicationStore.update(decodeURIComponent(id), { notes } as Partial<ParsedApplication>); setEditing(false); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save</button><button onClick={() => setEditing(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button></div></div> : <p className="text-sm text-muted-foreground">{notes || "No notes yet."}</p>}</section>
      </div>
      <aside className="space-y-6"><section className="rounded-2xl border border-border bg-card p-6"><h2 className="mb-5 text-lg font-semibold">Application timeline</h2>{timeline.length ? <div className="space-y-5">{timeline.map((event, index) => { const eventRecord = event as unknown as Record<string, unknown>; const eventType = label(valueOf(eventRecord.type ?? eventRecord.event_type ?? "update")); const eventDate = eventRecord.date ?? eventRecord.createdAt ?? eventRecord.created_at; const summary = readableDetails(eventRecord.details ?? eventRecord.metadata ?? eventRecord.description); return <div key={`${eventType}-${index}`} className="relative pl-6"><span className="absolute left-0 top-1.5 size-2.5 rounded-full bg-primary" /><div className="text-sm font-medium">{eventType}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(eventDate)}</div>{summary && <p className="mt-2 text-sm text-muted-foreground">{summary}</p>}</div>; })}</div> : <p className="text-sm text-muted-foreground">No timeline events were extracted.</p>}</section><section className="rounded-2xl border border-border bg-card p-6"><h2 className="mb-4 text-lg font-semibold">Parser details</h2><div className="space-y-3 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">Confidence</span><span>{Math.round(confidence * 100)}%</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Parser version</span><span>{valueOf(appRecord.parserVersion) || "Unknown"}</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">Thread</span><span className="max-w-40 truncate">{valueOf(email?.gmailThreadId ?? appRecord.gmailThreadId) || "Not available"}</span></div></div></section>{jobUrl && <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"><ExternalLink size={16} /> View job posting</a>}</aside>
    </div>
    {overridingField && <FieldOverrideModal fieldName={overridingField} currentValue={status} confidenceScore={confidence} onSave={(value) => setOverride(overridingField, value)} onCancel={() => setOverridingField(null)} fieldType="select" selectOptions={[{ label: "Applied", value: "applied" }, { label: "Assessment", value: "assessment" }, { label: "Interview", value: "interview" }, { label: "Offer", value: "offer" }, { label: "Rejected", value: "rejected" }]} />}
  </div></main>;
}

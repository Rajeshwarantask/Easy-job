"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Edit2, Loader } from "lucide-react";
import { FieldOverrideModal } from "@/components/field-override-modal";
import { EditableField } from "@/components/editable-field";
import { ConfidenceBadge } from "@/components/confidence-badge";
import type { ParsedApplication, TimelineEvent } from "@/lib/parsing/types";
import ApplicationStore from "@/lib/store/application-store";
import {
  getApplicationId,
  getCompany,
  getRole,
  getLocation,
  getWorkMode,
  getParsingPlatform,
  getParserConfidence,
  getJobUrl,
  getStatus,
} from "@/lib/parsing/application-accessors";

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [application, setApplication] = useState<ParsedApplication | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [overridingField, setOverridingField] = useState<string | null>(null);

  // small local helpers to avoid any casts — local only, not exported
  function getFieldFromApp<T = unknown>(app: ParsedApplication | null, field: string): T | undefined {
    if (!app) return undefined;
    const r = app as unknown as Record<string, unknown>;
    const v = r[field];
    return v as T | undefined;
  }

  function getEventField<T = unknown>(ev: TimelineEvent | undefined, field: string): T | undefined {
    if (!ev) return undefined;
    const r = ev as unknown as Record<string, unknown>;
    return r[field] as T | undefined;
  }

  useEffect(() => {
    setLoading(true);
    const snapshot = ApplicationStore.read();
    const found = snapshot.applications.find((a) => getApplicationId(a) === id) ?? null;
    setApplication(found);
    setEvents((found?.timelineEvents ?? []) as TimelineEvent[]);
    setNotes(getFieldFromApp<string>(found, "notes") ?? "");
    setLoading(false);

    const unsub = ApplicationStore.subscribe((s) => {
      const f = s.applications.find((a) => getApplicationId(a) === id) ?? null;
      setApplication(f);
      setEvents((f?.timelineEvents ?? []) as TimelineEvent[]);
      setNotes(getFieldFromApp<string>(f, "notes") ?? "");
    });

    return () => unsub();
  }, [id]);

  const handleSaveNotes = () => {
    if (!application) return;
    // use store API to update fields
    ApplicationStore.updateFields(id, { notes });
    setEditing(false);
  };

  const handleFieldOverride = (fieldName: string, newValue: unknown) => {
    if (!application) return;

    if (fieldName === "status") {
      ApplicationStore.updateStatus(id, String(newValue));
      setOverridingField(null);
      return;
    }

    ApplicationStore.updateFields(id, { [fieldName]: newValue } as Partial<ParsedApplication>);
    setOverridingField(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/dashboard/applications" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
            <ArrowLeft size={20} />
            Back to applications
          </Link>
          <div className="text-center text-gray-400">Application not found</div>
        </div>
      </div>
    );
  }

  const company = getCompany(application) ?? "";
  const role = getRole(application) ?? "";
  const confidence = getParserConfidence(application) ?? 0;
  const platform = getParsingPlatform(application) ?? "";
  const location = getLocation(application) ?? undefined;
  const workMode = getWorkMode(application) ?? undefined;
  const jobUrl = getJobUrl(application) ?? undefined;
  const status = getStatus(application) ?? "";

  // legacy fields accessed via getFieldFromApp to avoid `any` and without adding new exported accessors
  const salaryMin = getFieldFromApp<number>(application, "salary_min");
  const salaryMax = getFieldFromApp<number>(application, "salary_max");
  const salaryCurrency = getFieldFromApp<string>(application, "salary_currency");

  const nextInterviewDate = getFieldFromApp<string>(application, "next_interview_date");
  const nextInterviewTime = getFieldFromApp<string>(application, "next_interview_time");
  const nextInterviewLink = getFieldFromApp<string>(application, "next_interview_link");
  const interviewerName = getFieldFromApp<string>(application, "interviewer_name");

  const timelineEvents = (application.timelineEvents ?? []) as TimelineEvent[];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <Link href="/dashboard/applications" className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8">
          <ArrowLeft size={20} />
          Back to applications
        </Link>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="md:col-span-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold">{role}</h1>
                  <p className="text-gray-400 mt-1">{company}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-2">Parser Confidence</div>
                  <ConfidenceBadge confidence={confidence} size="lg" showLabel />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-700">
                <EditableField label="Status" value={status} confidence={0.95} onEdit={() => setOverridingField("status")} formatValue={(v) => v?.charAt(0).toUpperCase() + v?.slice(1)} />
                <EditableField label="Platform" value={platform} confidence={0.9} onEdit={() => setOverridingField("parsing_platform")} />
                {location && <EditableField label="Location" value={location} confidence={0.75} onEdit={() => setOverridingField("location")} />}
                {workMode && <EditableField label="Work Mode" value={workMode} confidence={0.7} onEdit={() => setOverridingField("work_mode")} formatValue={(v) => v?.charAt(0).toUpperCase() + v?.slice(1)} />}
              </div>
            </div>

            {(salaryMin || salaryMax) && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Compensation</h2>
                <div className="text-2xl font-bold">
                  {salaryCurrency ?? ""} {salaryMin ?? salaryMax ?? ""}
                  {salaryMax && salaryMin && ` - ${salaryMax}`}
                </div>
              </div>
            )}

            {nextInterviewDate && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Interview</h2>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-gray-400">Date & Time</div>
                    <div className="mt-1">
                      {new Date(nextInterviewDate).toLocaleDateString()}
                      {nextInterviewTime && ` at ${nextInterviewTime}`}
                    </div>
                  </div>
                  {nextInterviewLink && (
                    <div>
                      <div className="text-sm text-gray-400">Meeting Link</div>
                      <a href={nextInterviewLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mt-1">
                        Join meeting
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  )}
                  {interviewerName && (
                    <div>
                      <div className="text-sm text-gray-400">Interviewer</div>
                      <div className="mt-1">{interviewerName}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Notes</h2>
                <button onClick={() => setEditing(!editing)} className="p-2 hover:bg-gray-800 rounded transition-colors">
                  <Edit2 size={16} />
                </button>
              </div>
              {editing ? (
                <div>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white mb-3" rows={4} placeholder="Add your notes..." />
                  <div className="flex gap-2">
                    <button onClick={handleSaveNotes} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors">Save</button>
                    <button onClick={() => setEditing(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-300">{notes || "No notes yet"}</p>
              )}
            </div>
          </div>

          {/* Sidebar - Email events */}
          <div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Timeline ({timelineEvents.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {timelineEvents.map((event) => {
                  const eventRecord = event as unknown as Record<string, unknown>;
                  const eventId = (eventRecord.id as string) ?? String(eventRecord.date ?? Math.random());
                  const eventType = (eventRecord.event_type as string) ?? (eventRecord.type as string) ?? "Update";
                  const eventDateRaw = (eventRecord.date as string) ?? (eventRecord.createdAt as string) ?? (eventRecord.created_at as string);
                  const eventSummary = (eventRecord.details && (eventRecord.details as any).brief) ?? (eventRecord.details as string) ?? undefined;

                  return (
                    <div key={eventId} className="pb-3 border-b border-gray-700 last:border-0">
                      <div className="text-sm font-medium capitalize">{eventType}</div>
                      <div className="text-xs text-gray-400 mt-1">{eventDateRaw ? new Date(eventDateRaw).toLocaleDateString() : ""}</div>
                      {eventSummary && <div className="text-xs text-gray-300 mt-2">{String(eventSummary)}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {jobUrl && (
              <div className="mt-6">
                <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors w-full justify-center">
                  <ExternalLink size={16} />
                  View Job Posting
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Override modal */}
        {overridingField && application && (
          <FieldOverrideModal
            fieldName={overridingField}
            currentValue={getFieldFromApp(application, overridingField)}
            confidenceScore={getParserConfidence(application) || 0.5}
            onSave={(newValue) => handleFieldOverride(overridingField, newValue)}
            onCancel={() => setOverridingField(null)}
            fieldType={overridingField === "status" ? "select" : "text"}
            selectOptions={
              overridingField === "status"
                ? [
                    { label: "Applied", value: "applied" },
                    { label: "Assessment", value: "assessment" },
                    { label: "Interview", value: "interview" },
                    { label: "Offer", value: "offer" },
                    { label: "Rejected", value: "rejected" },
                  ]
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

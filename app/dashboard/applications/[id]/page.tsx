"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Application, EmailEvent } from "@/lib/db-types";
import { ArrowLeft, ExternalLink, Edit2, Loader } from "lucide-react";
import { FieldOverrideModal } from "@/components/field-override-modal";
import { EditableField } from "@/components/editable-field";
import { ConfidenceBadge } from "@/components/confidence-badge";

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState("");
  const [overridingField, setOverridingField] = useState<string | null>(null);

  useEffect(() => {
    const loadApplication = async () => {
      try {
        const res = await fetch(`/api/applications/${id}`);
        if (!res.ok) throw new Error("Failed to load application");

        const data = await res.json();
        setApplication(data.application);
        setEvents(data.email_events || []);
        setNotes(data.application.notes || "");
      } catch (err) {
        console.error("[v0] Error loading application:", err);
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [id]);

  const handleSaveNotes = async () => {
    if (!application) return;

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      if (!res.ok) throw new Error("Failed to save notes");

      setApplication(await res.json());
      setEditing(false);
    } catch (err) {
      console.error("[v0] Error saving notes:", err);
    }
  };

  const handleFieldOverride = async (fieldName: string, newValue: any) => {
    if (!application) return;

    try {
      const updateData: Record<string, any> = {};
      updateData[fieldName] = newValue;

      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) throw new Error("Failed to update field");

      const updatedApp = await res.json();
      setApplication(updatedApp);
      setOverridingField(null);
    } catch (err) {
      console.error("[v0] Error updating field:", err);
      throw err;
    }
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
          <Link
            href="/dashboard/applications"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8"
          >
            <ArrowLeft size={20} />
            Back to applications
          </Link>
          <div className="text-center text-gray-400">Application not found</div>
        </div>
      </div>
    );
  }

  const confidencePercent = Math.round((application.parser_confidence || 0) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <Link
          href="/dashboard/applications"
          className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-8"
        >
          <ArrowLeft size={20} />
          Back to applications
        </Link>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main info */}
          <div className="md:col-span-2">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold">{application.role}</h1>
                  <p className="text-gray-400 mt-1">{application.company}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400 mb-2">Parser Confidence</div>
                  <ConfidenceBadge
                    confidence={application.parser_confidence || 0}
                    size="lg"
                    showLabel
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-700">
                <EditableField
                  label="Status"
                  value={application.status}
                  confidence={0.95}
                  onEdit={() => setOverridingField("status")}
                  formatValue={(v) => v?.charAt(0).toUpperCase() + v?.slice(1)}
                />
                <EditableField
                  label="Platform"
                  value={application.parsing_platform}
                  confidence={0.9}
                  onEdit={() => setOverridingField("parsing_platform")}
                />
                {application.location && (
                  <EditableField
                    label="Location"
                    value={application.location}
                    confidence={0.75}
                    onEdit={() => setOverridingField("location")}
                  />
                )}
                {application.work_mode && (
                  <EditableField
                    label="Work Mode"
                    value={application.work_mode}
                    confidence={0.7}
                    onEdit={() => setOverridingField("work_mode")}
                    formatValue={(v) => v?.charAt(0).toUpperCase() + v?.slice(1)}
                  />
                )}
              </div>
            </div>

            {/* Salary info */}
            {(application.salary_min || application.salary_max) && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Compensation</h2>
                <div className="text-2xl font-bold">
                  {application.salary_currency} {application.salary_min || application.salary_max}
                  {application.salary_max &&
                    application.salary_min &&
                    ` - ${application.salary_max}`}
                </div>
              </div>
            )}

            {/* Interview info */}
            {application.next_interview_date && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Interview</h2>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-gray-400">Date & Time</div>
                    <div className="mt-1">
                      {new Date(application.next_interview_date).toLocaleDateString()}
                      {application.next_interview_time && ` at ${application.next_interview_time}`}
                    </div>
                  </div>
                  {application.next_interview_link && (
                    <div>
                      <div className="text-sm text-gray-400">Meeting Link</div>
                      <a
                        href={application.next_interview_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-2 mt-1"
                      >
                        Join meeting
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  )}
                  {application.interviewer_name && (
                    <div>
                      <div className="text-sm text-gray-400">Interviewer</div>
                      <div className="mt-1">{application.interviewer_name}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Notes</h2>
                <button
                  onClick={() => setEditing(!editing)}
                  className="p-2 hover:bg-gray-800 rounded transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              {editing ? (
                <div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white mb-3"
                    rows={4}
                    placeholder="Add your notes..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      Cancel
                    </button>
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
              <h2 className="text-lg font-semibold mb-4">
                Timeline ({events.length})
              </h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="pb-3 border-b border-gray-700 last:border-0"
                  >
                    <div className="text-sm font-medium capitalize">
                      {event.event_type || "Update"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(event.created_at).toLocaleDateString()}
                    </div>
                    {event.email_subject && (
                      <div className="text-xs text-gray-300 mt-2">
                        {event.email_subject}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Job posting link */}
            {application.job_url && (
              <div className="mt-6">
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors w-full justify-center"
                >
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
            currentValue={
              application[overridingField as keyof Application]
            }
            confidenceScore={application.parser_confidence || 0.5}
            onSave={(newValue) =>
              handleFieldOverride(overridingField, newValue)
            }
            onCancel={() => setOverridingField(null)}
            fieldType={
              overridingField === "status" ? "select" : "text"
            }
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

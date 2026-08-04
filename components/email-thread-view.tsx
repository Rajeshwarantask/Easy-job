"use client";

import { format } from "date-fns";
import { ChevronDown, Mail, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { EmailThread } from "@/lib/thread-types";

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  date: Date;
  preview?: string;
  event_type?: string;
}

interface EmailThreadViewProps {
  thread: EmailThread;
  emails: EmailItem[];
}

export function EmailThreadView({ thread, emails }: EmailThreadViewProps) {
  const [expandedEmail, setExpandedEmail] = useState<string | null>(null);

  // Sort emails by date
  const sorted = [...emails].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getDaysInThread = () => {
    if (!thread.first_email_date || !thread.last_email_date) return 0;
    return Math.floor(
      (new Date(thread.last_email_date).getTime() -
        new Date(thread.first_email_date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
  };

  const getEventTypeColor = (eventType?: string) => {
    if (!eventType) return "text-gray-400";
    const lower = eventType.toLowerCase();
    if (lower.includes("reject")) return "text-red-400";
    if (lower.includes("offer")) return "text-green-400";
    if (lower.includes("interview")) return "text-orange-400";
    if (lower.includes("assess")) return "text-purple-400";
    return "text-blue-400";
  };

  return (
    <div className="space-y-4">
      {/* Thread summary */}
      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Thread Started</div>
            <div className="text-sm font-semibold">
              {thread.first_email_date
                ? format(new Date(thread.first_email_date), "MMM d, yyyy")
                : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Last Email</div>
            <div className="text-sm font-semibold">
              {thread.last_email_date
                ? format(new Date(thread.last_email_date), "MMM d, yyyy")
                : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Duration</div>
            <div className="text-sm font-semibold">{getDaysInThread()} days</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Email Count</div>
            <div className="text-sm font-semibold">{thread.email_count}</div>
          </div>
        </div>

        {thread.subject_prefix && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="text-xs text-gray-400 mb-1">Subject</div>
            <div className="text-sm truncate">{thread.subject_prefix}</div>
          </div>
        )}

        {thread.estimated_next_action && (
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700 rounded">
            <div className="text-xs text-blue-300 font-semibold mb-1">
              Suggested Next Step
            </div>
            <div className="text-sm text-blue-100">
              {thread.estimated_next_action}
            </div>
          </div>
        )}
      </div>

      {/* Email thread */}
      <div className="space-y-2">
        <h3 className="font-semibold text-white">Email Thread</h3>

        {sorted.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            No emails in thread
          </div>
        ) : (
          sorted.map((email, index) => (
            <div key={email.id} className="bg-gray-900/50 border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() =>
                  setExpandedEmail(
                    expandedEmail === email.id ? null : email.id
                  )
                }
                className="w-full p-4 flex items-start justify-between hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 text-left">
                  <Mail size={18} className="text-gray-500 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white truncate">
                        {email.from}
                      </span>
                      {email.event_type && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${getEventTypeColor(
                            email.event_type
                          )} bg-gray-800`}
                        >
                          {email.event_type}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300 truncate">
                      {email.subject}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {format(new Date(email.date), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                </div>

                <ChevronDown
                  size={20}
                  className={`text-gray-500 flex-shrink-0 ml-2 transition-transform ${
                    expandedEmail === email.id ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Expanded email content */}
              {expandedEmail === email.id && (
                <div className="border-t border-gray-700 bg-gray-800/30 p-4 space-y-3">
                  {email.preview && (
                    <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-80 overflow-y-auto">
                      {email.preview}
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t border-gray-700">
                    <button className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors flex items-center gap-1">
                      <ExternalLink size={14} />
                      View in Gmail
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

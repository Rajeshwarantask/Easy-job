"use client";

import { format } from "date-fns";
import type { ThreadTimelineEvent } from "@/lib/thread-types";
import {
  CheckCircle,
  FileText,
  MessageSquare,
  Trophy,
  AlertCircle,
  Clock,
} from "lucide-react";

interface EmailTimelineProps {
  events: ThreadTimelineEvent[];
  compact?: boolean;
}

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case "applied":
      return <FileText className="w-5 h-5" />;
    case "assessment":
      return <MessageSquare className="w-5 h-5" />;
    case "interview":
      return <Clock className="w-5 h-5" />;
    case "offer":
      return <Trophy className="w-5 h-5" />;
    case "rejection":
      return <AlertCircle className="w-5 h-5" />;
    default:
      return <CheckCircle className="w-5 h-5" />;
  }
};

const getEventColor = (eventType: string) => {
  switch (eventType) {
    case "applied":
      return "bg-blue-900 text-blue-200 border-blue-700";
    case "assessment":
      return "bg-purple-900 text-purple-200 border-purple-700";
    case "interview":
      return "bg-orange-900 text-orange-200 border-orange-700";
    case "offer":
      return "bg-green-900 text-green-200 border-green-700";
    case "rejection":
      return "bg-red-900 text-red-200 border-red-700";
    default:
      return "bg-gray-800 text-gray-200 border-gray-700";
  }
};

const getEventLabel = (eventType: string) => {
  const labels: Record<string, string> = {
    applied: "Applied",
    assessment: "Assessment",
    interview: "Interview",
    interview_scheduled: "Interview Scheduled",
    interview_completed: "Interview Completed",
    offer: "Offer",
    rejection: "Rejected",
    status_update: "Update",
  };
  return labels[eventType] || eventType;
};

export function EmailTimeline({
  events,
  compact = false,
}: EmailTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No events recorded yet
      </div>
    );
  }

  // Sort events by date
  const sorted = [...events].sort(
    (a, b) =>
      (a.event_date ? new Date(a.event_date).getTime() : 0) -
      (b.event_date ? new Date(b.event_date).getTime() : 0)
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {sorted.map((event, index) => (
          <div key={event.id} className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded ${getEventColor(event.event_type)} border`}
              title={`${getEventLabel(event.event_type)} - ${
                event.event_date ? format(new Date(event.event_date), "MMM d") : "No date"
              }`}
            >
              {getEventIcon(event.event_type)}
            </div>
            {index < sorted.length - 1 && (
              <div className="text-gray-600 text-lg">→</div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sorted.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div
              className={`p-2 rounded-lg border ${getEventColor(event.event_type)}`}
            >
              {getEventIcon(event.event_type)}
            </div>

            {index < sorted.length - 1 && (
              <div className="w-1 h-12 bg-gradient-to-b from-gray-700 to-gray-800 mt-2" />
            )}
          </div>

          {/* Event details */}
          <div className="pb-6 flex-1">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-white">
                    {getEventLabel(event.event_type)}
                  </h4>
                  {event.title && (
                    <p className="text-sm text-gray-300 mt-1">{event.title}</p>
                  )}
                </div>
                {event.event_date && (
                  <div className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {format(new Date(event.event_date), "MMM d, yyyy")}
                  </div>
                )}
              </div>

              {event.description && (
                <p className="text-sm text-gray-400 line-clamp-2 mt-2">
                  {event.description}
                </p>
              )}

              {/* Days since previous event */}
              {index > 0 && event.event_date && sorted[index - 1].event_date && (
                <div className="mt-3 pt-2 border-t border-gray-700">
                  <span className="text-xs text-gray-500">
                    {Math.ceil(
                      (new Date(event.event_date).getTime() -
                        new Date(sorted[index - 1].event_date!).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}{" "}
                    days from previous event
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

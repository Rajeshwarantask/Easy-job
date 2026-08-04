"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader, AlertCircle } from "lucide-react";
import type { EmailThread } from "@/lib/thread-types";
import { EmailTimeline } from "@/components/email-timeline";
import { EmailThreadView } from "@/components/email-thread-view";

interface ThreadWithEmails extends EmailThread {
  events: any[];
  emails: any[];
}

export default function ThreadDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [thread, setThread] = useState<ThreadWithEmails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadThread();
  }, [id]);

  const loadThread = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/applications/${id}/threads`);
      if (!res.ok) throw new Error("Failed to load threads");

      const data = await res.json();
      setThread(data.threads[0] || null);

      if (!data.threads || data.threads.length === 0) {
        setError("No email threads found for this application");
      }
    } catch (err) {
      console.error("[v0] Error loading thread:", err);
      setError(err instanceof Error ? err.message : "Failed to load thread");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <div className="border-b border-gray-700 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href={`/dashboard/applications/${id}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Application
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-200">Error</h3>
              <p className="text-red-100 text-sm mt-1">{error}</p>
            </div>
          </div>
        ) : thread ? (
          <div className="space-y-8">
            {/* Timeline Overview */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Application Timeline</h2>
              {thread.events && thread.events.length > 0 && (
                <EmailTimeline events={thread.events} compact={false} />
              )}
            </div>

            {/* Thread Details */}
            <div>
              <h2 className="text-2xl font-bold mb-6">Email Thread</h2>
              {thread.emails && thread.emails.length > 0 && (
                <EmailThreadView thread={thread} emails={thread.emails} />
              )}
            </div>

            {/* Thread Metadata */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
              <h3 className="font-semibold text-lg mb-4">Thread Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-400 text-sm">Thread ID</span>
                  <p className="font-mono text-xs text-gray-300 mt-1 break-all">
                    {thread.gmail_thread_id}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Sender Domain</span>
                  <p className="text-sm mt-1">{thread.sender_domain}</p>
                </div>
                {thread.primary_sender && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      Primary Sender
                    </span>
                    <p className="text-sm mt-1">{thread.primary_sender}</p>
                  </div>
                )}
                {thread.status_progression && (
                  <div>
                    <span className="text-gray-400 text-sm">
                      Status Progression
                    </span>
                    <p className="text-sm mt-1">
                      {thread.status_progression.join(" → ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            No thread data available
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Application, ApplicationStatus } from "@/lib/db-types";
import { Star, Archive, ExternalLink } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";

interface ApplicationsTableProps {
  applications: Application[];
  onStatusChange?: (id: string, status: ApplicationStatus) => void;
  onStar?: (id: string, starred: boolean) => void;
}

export function ApplicationsTable({
  applications,
  onStatusChange,
  onStar,
}: ApplicationsTableProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getStatusColor = (status: ApplicationStatus) => {
    const colors: Record<ApplicationStatus, string> = {
      applied: "bg-blue-900 text-blue-100",
      assessment: "bg-purple-900 text-purple-100",
      interview: "bg-orange-900 text-orange-100",
      offer: "bg-green-900 text-green-100",
      rejected: "bg-red-900 text-red-100",
      archived: "bg-gray-900 text-gray-100",
    };
    return colors[status];
  };



  return (
    <div className="overflow-x-auto border border-gray-700 rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-900">
            <th className="px-4 py-2 text-left">Company</th>
            <th className="px-4 py-2 text-left">Role</th>
            <th className="px-4 py-2 text-left">Location</th>
            <th className="px-4 py-2 text-center">Status</th>
            <th className="px-4 py-2 text-center">Confidence</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <tr
              key={app.id}
              className="border-b border-gray-700 hover:bg-gray-800 transition-colors"
              onMouseEnter={() => setHoveredId(app.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <td className="px-4 py-3">
                <div className="font-medium">{app.company}</div>
                <div className="text-xs text-gray-400">
                  {app.parsing_platform}
                </div>
              </td>
              <td className="px-4 py-3">
                <div>{app.role}</div>
                {app.work_mode && (
                  <div className="text-xs text-gray-400 capitalize">
                    {app.work_mode}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-300">
                {app.location || "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                    app.status as ApplicationStatus
                  )}`}
                >
                  {app.status}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {app.parser_confidence && (
                  <ConfidenceBadge
                    confidence={app.parser_confidence / 100}
                    size="sm"
                    tooltip="Parser confidence score"
                  />
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  {hoveredId === app.id && (
                    <>
                      <button
                        onClick={() => onStar?.(app.id, !app.starred)}
                        className="p-1 hover:bg-gray-700 rounded"
                        title={app.starred ? "Unstar" : "Star"}
                      >
                        <Star
                          size={16}
                          className={
                            app.starred ? "fill-yellow-400 text-yellow-400" : ""
                          }
                        />
                      </button>
                      {app.job_url && (
                        <a
                          href={app.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-700 rounded"
                          title="View job posting"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="p-1 hover:bg-gray-700 rounded"
                        title="View details"
                      >
                        <span className="text-xs">View</span>
                      </Link>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {applications.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          No applications found. Sync your Gmail to get started.
        </div>
      )}
    </div>
  );
}

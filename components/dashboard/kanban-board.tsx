"use client";

import { useCallback } from "react";
import { KanbanColumn } from "./kanban-column";
import type { JobApplication, JobStatus } from "@/lib/types";
import { KANBAN_COLUMNS } from "@/lib/types";

interface KanbanBoardProps {
  jobs: JobApplication[];
  isDemo?: boolean;
}

export function KanbanBoard({ jobs, isDemo = false }: KanbanBoardProps) {
  const getJobsByStatus = useCallback(
    (status: JobStatus) => {
      return jobs.filter((job) => job.status === status);
    },
    [jobs]
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-4 lg:px-6">
      {KANBAN_COLUMNS.map((column) => (
        <KanbanColumn
          key={column.id}
          id={column.id}
          title={column.title}
          jobs={getJobsByStatus(column.id)}
        />
      ))}
    </div>
  );
}

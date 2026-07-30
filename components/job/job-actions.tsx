"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobWithEvents } from "@/lib/types";

interface JobActionsProps {
  job: JobWithEvents;
}

export function JobActions({ job }: JobActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">About This Job</CardTitle>
        <CardDescription>
          This application is sourced from your Gmail. Status is determined by email content.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <strong>Current Status:</strong> {job.status}
        </div>
        {job.deadline && (
          <div>
            <strong>Deadline:</strong> {new Date(job.deadline).toLocaleDateString()}
          </div>
        )}
        {job.gmail_thread_id && (
          <div className="pt-2 border-t border-border">
            <p>
              All information is pulled from Gmail emails to {job.company}. 
              Edits are not possible—to update, change the original email thread.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AddJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddJobDialog({ open, onOpenChange }: AddJobDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Jobs from Gmail</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Jobs are automatically extracted from your Gmail inbox. No manual entry needed—just send or receive recruitment emails and they'll show up here.
          </p>
          <p className="text-sm text-muted-foreground">
            Click "Sync Now" on the dashboard to fetch the latest emails from Gmail.
          </p>
          <div className="flex justify-end pt-4">
            <Button onClick={() => onOpenChange(false)}>Got it</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

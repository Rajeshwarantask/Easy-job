"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "cmdk";
import {
  Building2,
  LayoutDashboard,
  GitBranch,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  CheckCircle,
  Clock,
  XCircle,
  Award,
  MessageSquare,
  CalendarDays,
  BarChart3,
} from "lucide-react";
import { useSyncJobs, runSync } from "@/hooks/use-sync-jobs";
import { useTheme } from "@/components/providers/theme-provider";
import { STATUS_CONFIG } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_ICONS = {
  applied: CheckCircle,
  interview: MessageSquare,
  offer: Award,
  rejected: XCircle,
  withdrawn: Clock,
};

interface CommandPaletteProps {
  onAddJob?: () => void;
}

export function CommandPalette({ onAddJob }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { jobs } = useSyncJobs();
  const { theme, toggle } = useTheme();

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  const filteredJobs = query.trim()
    ? jobs.filter(
        (j) =>
          j.company.toLowerCase().includes(query.toLowerCase()) ||
          (j.role ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : jobs.slice(0, 5);

  return (
    <>
      {/* Trigger hint shown in header */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-border",
          "bg-background text-muted-foreground text-sm hover:bg-accent transition-colors"
        )}
        aria-label="Open command palette"
      >
        <span>Search...</span>
        <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">
          <span>⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        {/* Custom overlay + dialog using cmdk primitives */}
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="fixed inset-0 bg-black/50"
              aria-hidden="true"
            />
            <Command
              className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-popover shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            >
              <div className="flex items-center border-b border-border px-3">
                <CommandInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search companies, navigate, actions..."
                  className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>

              <CommandList className="max-h-80 overflow-y-auto p-2">
                <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                  No results found.
                </CommandEmpty>

                {/* Navigation */}
                <CommandGroup heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  <CommandItem
                    onSelect={() => go("/dashboard")}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <LayoutDashboard className="w-4 h-4 text-muted-foreground shrink-0" />
                    Dashboard
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go("/timeline")}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <GitBranch className="w-4 h-4 text-muted-foreground shrink-0" />
                    All Applications
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go("/calendar")}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                    Calendar
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go("/insights")}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <BarChart3 className="w-4 h-4 text-muted-foreground shrink-0" />
                    Insights
                  </CommandItem>
                </CommandGroup>

                <CommandSeparator className="my-1 h-px bg-border" />

                {/* Actions */}
                <CommandGroup heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                  <CommandItem
                    onSelect={() => { setOpen(false); onAddJob?.(); }}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    Add job manually
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { setOpen(false); runSync(true); }}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
                    Sync Gmail now
                  </CommandItem>
                  <CommandItem
                    onSelect={() => { setOpen(false); toggle(); }}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                  >
                    {theme === "dark"
                      ? <Sun className="w-4 h-4 text-muted-foreground shrink-0" />
                      : <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                    }
                    Toggle {theme === "dark" ? "light" : "dark"} mode
                  </CommandItem>
                </CommandGroup>

                {filteredJobs.length > 0 && (
                  <>
                    <CommandSeparator className="my-1 h-px bg-border" />
                    <CommandGroup heading="Applications" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                      {filteredJobs.map((job) => {
                        const cfg = STATUS_CONFIG[job.status];
                        const Icon = STATUS_ICONS[job.status];
                        return (
                          <CommandItem
                            key={job.id}
                            onSelect={() => go("/timeline")}
                            className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer hover:bg-accent text-sm aria-selected:bg-accent"
                          >
                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate font-medium">{job.company}</span>
                            {job.role && (
                              <span className="truncate text-muted-foreground text-xs max-w-[120px]">{job.role}</span>
                            )}
                            <span className={cn("text-xs font-medium shrink-0", cfg.color)}>{cfg.label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>

              <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span><kbd className="font-mono">↑↓</kbd> navigate</span>
                <span><kbd className="font-mono">↵</kbd> select</span>
                <span><kbd className="font-mono">esc</kbd> close</span>
              </div>
            </Command>
          </div>
        )}
      </CommandDialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  User, Moon, Sun, RefreshCw, Download, LogOut, Bell, Shield, Mail, Calendar,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/providers/theme-provider";
import { useSyncJobs, runSync } from "@/hooks/use-sync-jobs";
import { cn } from "@/lib/utils";

interface SettingsClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

function Section({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SettingsClient({ user }: SettingsClientProps) {
  const { theme, toggle } = useTheme();
  const { jobs, lastSynced, status } = useSyncJobs();
  const [syncing, setSyncing] = useState(false);
  const [exported, setExported] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "7days" | "30days" | "90days">("all");

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      // Use streaming endpoint for real-time job updates
      const url = `/api/sync/stream${dateRange !== "all" ? `?dateRange=${dateRange}` : ""}`;
      const eventSource = new EventSource(url);
      
      let jobCount = 0;
      
      eventSource.addEventListener("job", (event) => {
        jobCount++;
        try {
          const message = JSON.parse(event.data);
          console.log("[v0] Job saved:", message.data.company);
        } catch (err) {
          console.error("Failed to parse job:", err);
        }
      });
      
      eventSource.addEventListener("complete", (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[v0] Sync complete:", message.stats);
        } catch (err) {
          console.error("Failed to parse complete:", err);
        } finally {
          setSyncing(false);
          eventSource.close();
          // Refetch jobs
          runSync(true);
        }
      });
      
      eventSource.addEventListener("error", () => {
        setSyncing(false);
        eventSource.close();
      });
    } catch (err) {
      console.error("[v0] Sync error:", err);
      setSyncing(false);
    }
  };

  const handleExport = () => {
    const csv = [
      ["Company", "Role", "Location", "Platform", "Status", "Applied Date", "Last Activity"],
      ...jobs.map((j) => [
        j.company,
        j.role ?? "",
        j.location ?? "",
        j.platform ?? "",
        j.status,
        j.applied_date ?? "",
        j.last_activity ?? "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobtrail-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <div className="py-6 px-4 lg:px-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences and account</p>
      </div>

      {/* Account */}
      <Section title="Account" description="Your connected Google account">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center gap-3">
            {user?.image ? (
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.name ?? "Guest"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email ?? "Not signed in"}</p>
            </div>
            {user && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={async () => {
                  await fetch("/api/auth/clear", { method: "POST" });
                  signOut({ callbackUrl: "/" });
                }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </Button>
            )}
          </div>
        </Card>
      </Section>

      {/* Appearance */}
      <Section title="Appearance" description="Choose your preferred colour scheme">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark"
                ? <Moon className="w-4 h-4 text-muted-foreground" />
                : <Sun className="w-4 h-4 text-muted-foreground" />
              }
              <div>
                <p className="text-sm font-medium text-foreground">
                  {theme === "dark" ? "Dark mode" : "Light mode"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Currently using {theme} theme
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggle} className="gap-2">
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              Switch to {theme === "dark" ? "light" : "dark"}
            </Button>
          </div>
        </Card>
      </Section>

      {/* Gmail sync */}
      <Section title="Gmail sync" description="Control how JobTrail reads your inbox">
        <Card className="p-4 light:glass light:shadow-sm space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Sync emails from
            </label>
            <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7days">Past 7 days</SelectItem>
                <SelectItem value="30days">Past 30 days</SelectItem>
                <SelectItem value="90days">Past 90 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Limiting the date range speeds up syncing and prevents timeouts on large mailboxes.
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Sync now</p>
                <p className="text-xs text-muted-foreground">
                  {lastSynced
                    ? `Last synced at ${lastSynced.toLocaleTimeString()}`
                    : "Never synced"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || status === "syncing"}
              className="gap-2"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              {syncing ? "Syncing..." : "Sync Gmail"}
            </Button>
          </div>
          <div className="flex items-start gap-3 pt-2 border-t border-border">
            <Bell className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Auto-sync</p>
              <p className="text-xs text-muted-foreground">
                Gmail is automatically synced every 5 minutes while the app is open.
                Background polling refreshes your data every 2 minutes.
              </p>
            </div>
          </div>
        </Card>
      </Section>

      {/* Data */}
      <Section title="Your data" description="Export or manage your application data">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Download className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Export to CSV</p>
                <p className="text-xs text-muted-foreground">
                  Download all {jobs.length} application{jobs.length !== 1 ? "s" : ""} as a spreadsheet
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={jobs.length === 0}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              {exported ? "Downloaded!" : "Export"}
            </Button>
          </div>
        </Card>
      </Section>

      {/* Privacy */}
      <Section title="Privacy" description="How your data is stored">
        <Card className="p-4 light:glass light:shadow-sm">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1 text-xs text-muted-foreground leading-relaxed">
              <p>
                JobTrail reads your Gmail inbox to detect job-related emails. It stores
                extracted metadata (company, role, status) — not the full email body.
              </p>
              <p>
                Your Google OAuth tokens are stored securely and are only used to
                read emails matching job-related patterns.
              </p>
            </div>
          </div>
        </Card>
      </Section>
    </div>
  );
}

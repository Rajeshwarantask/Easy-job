"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Menu,
  LayoutDashboard,
  GitBranch,
  CalendarDays,
  BarChart3,
  Settings,
  Briefcase,
  Search,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  {
    group: "App",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview, stats & activity" },
      { href: "/job-search", label: "Job Search", icon: Search, description: "Find jobs across LinkedIn, Indeed & more" },
      { href: "/saved-jobs", label: "Saved Jobs", icon: Bookmark, description: "Bookmarked listings from job search" },
      { href: "/timeline", label: "Applications", icon: GitBranch, description: "Search, filter & track stages" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, description: "Deadlines & interview dates" },
      { href: "/insights", label: "Insights", icon: BarChart3, description: "Charts, funnel & analytics" },
      { href: "/settings", label: "Settings", icon: Settings, description: "Preferences & account" },
    ],
  },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 pt-5 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-left">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
              <Briefcase className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            JobTrail
          </SheetTitle>
        </SheetHeader>

        <nav className="py-3 px-2 space-y-1">
          {NAV_LINKS[0].items.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground text-center">
            Gmail syncs automatically every 5 min
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <Link href="/privacy" onClick={() => setOpen(false)} className="underline underline-offset-2 hover:text-foreground transition-colors">
              Privacy
            </Link>
            <span>&middot;</span>
            <Link href="/terms" onClick={() => setOpen(false)} className="underline underline-offset-2 hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

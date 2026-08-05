"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Briefcase, LogOut, Moon, Settings, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddJobDialog } from "./add-job-dialog";
import { HamburgerMenu } from "@/components/nav/hamburger-menu";
import { useTheme } from "@/components/providers/theme-provider";

interface DashboardHeaderProps {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  } | null;
  isDemo?: boolean;
}

export function DashboardHeader({ user, isDemo = false }: DashboardHeaderProps) {
  const [showAddJob, setShowAddJob] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <HamburgerMenu />
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Briefcase className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">JobTrail</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">

          {isDemo ? (
            <Link href="/">
              <Button size="sm" variant="outline">
                Sign in
              </Button>
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
                    <AvatarFallback>
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggle}>
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await fetch("/api/auth/clear", { method: "POST" });
                    signOut({ callbackUrl: "/" });
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <AddJobDialog open={showAddJob} onOpenChange={setShowAddJob} />
    </header>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Briefcase, Mail, ArrowRight, Sparkles, Clock, LayoutGrid, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/providers");
      const providers = await res.json();

      if (!providers?.google) {
        setShowSetupDialog(true);
        setIsLoading(false);
        return;
      }

      // OAuth is configured — signIn is imported statically, no CSRF issue
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch {
      setShowSetupDialog(true);
      setIsLoading(false);
    }
  };

  const handleDemoMode = () => {
    setShowSetupDialog(false);
    router.push("/dashboard?demo=true");
  };

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <Briefcase className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">JobTrail</span>
        </div>
        <Button onClick={handleSignIn} size="sm" variant="secondary" disabled={isLoading}>
          {isLoading ? "Loading..." : "Sign in"}
        </Button>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-powered job tracking</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground text-balance">
            Track your job applications automatically
          </h1>
          
          <p className="text-lg text-muted-foreground text-balance max-w-lg mx-auto">
            Connect your Gmail and let JobTrail organize your job search. No more spreadsheets, no more lost applications.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Button onClick={handleSignIn} size="lg" className="gap-2 h-12 px-6" disabled={isLoading}>
              <Mail className="w-5 h-5" />
              {isLoading ? "Connecting..." : "Continue with Google"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            We only read job-related emails. Your data stays private.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-medium text-muted-foreground mb-8 uppercase tracking-wider">
            How it works
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Mail className="w-5 h-5" />}
              title="Auto-detect emails"
              description="JobTrail scans your inbox for job-related emails and extracts application data automatically."
            />
            <FeatureCard
              icon={<LayoutGrid className="w-5 h-5" />}
              title="Kanban board"
              description="Visualize your pipeline with a drag-and-drop board. Track Applied, Interview, Offer, and more."
            />
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="Activity timeline"
              description="See every interaction with a company in one place. Never miss a follow-up."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span>JobTrail</span>
          <span>Built for job seekers</span>
        </div>
      </footer>

      {/* Setup Required Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Google OAuth Not Configured
            </DialogTitle>
            <div className="space-y-3 pt-2 text-sm text-muted-foreground" aria-describedby={undefined}>
              <span className="block">
                To sign in with Google, set up OAuth credentials in the Google Cloud Console and add these environment variables:
              </span>
              <div className="space-y-1.5">
                <div><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">AUTH_GOOGLE_ID</code></div>
                <div><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">AUTH_GOOGLE_SECRET</code></div>
                <div><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">AUTH_SECRET</code></div>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={handleDemoMode} variant="default">
              Try Demo Mode
            </Button>
            <Button onClick={() => setShowSetupDialog(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-3 p-6 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

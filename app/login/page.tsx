"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Briefcase, Mail } from "lucide-react";

export default function LoginPage() {
  const handleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary">
            <Briefcase className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            JobTrail
          </h1>
          <p className="text-muted-foreground text-balance max-w-sm">
            Track your job applications automatically. Connect your Gmail and let AI organize your job search.
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleSignIn}
            className="w-full h-12 text-base font-medium gap-3"
            size="lg"
          >
            <Mail className="w-5 h-5" />
            Continue with Google
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            We&apos;ll access your Gmail to automatically detect job-related emails and organize your applications.
          </p>
        </div>

        <div className="space-y-4 pt-8 border-t border-border">
          <h2 className="text-sm font-medium text-center text-muted-foreground">
            How it works
          </h2>
          <div className="grid gap-4">
            <FeatureItem
              step="1"
              title="Connect Gmail"
              description="Securely link your Google account"
            />
            <FeatureItem
              step="2"
              title="Auto-detect jobs"
              description="We scan for job-related emails"
            />
            <FeatureItem
              step="3"
              title="Track progress"
              description="See all applications in one place"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureItem({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-sm font-medium shrink-0">
        {step}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

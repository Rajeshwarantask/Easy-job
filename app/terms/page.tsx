import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service | JobTrail",
  description: "Terms and conditions for using JobTrail.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Terms of Service</h1>
          </div>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using JobTrail you agree to be bound by these Terms of Service and
              our{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Description of Service</h2>
            <p>
              JobTrail is a personal job application tracking tool. It connects to your Gmail inbox
              via Google OAuth (read-only) to automatically detect job-application emails and
              organise them into a dashboard, timeline, and analytics view. The service is intended
              for personal, non-commercial use only.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Google Account and Gmail access</h2>
            <p>
              When you sign in with Google, you grant JobTrail permission to read your Gmail
              messages using the <code className="bg-muted px-1 rounded text-xs">gmail.readonly</code>{" "}
              OAuth scope. This access is used solely to identify and parse job-related emails.
              JobTrail cannot send, modify, or delete your emails. You may revoke this access at
              any time through{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google Account Permissions
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. User responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You must be at least 13 years old to use JobTrail.</li>
              <li>You are responsible for maintaining the security of your Google account.</li>
              <li>You may not use the service for any unlawful purpose.</li>
              <li>You may not attempt to reverse-engineer, scrape, or disrupt the service.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Data and privacy</h2>
            <p>
              Your use of JobTrail is also governed by our{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                Privacy Policy
              </Link>
              , which explains what data we collect, how we use it, and how you can delete it.
              We do not sell your data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Account deletion</h2>
            <p>
              You may delete your account and all associated data at any time from the{" "}
              <Link href="/settings" className="text-primary underline underline-offset-2">
                Settings
              </Link>{" "}
              page. Upon deletion, all personal data is permanently removed within 30 days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Disclaimer of warranties</h2>
            <p>
              JobTrail is provided &quot;as is&quot; without warranties of any kind. We do not guarantee
              that the service will be error-free, uninterrupted, or that all job-application emails
              will be detected accurately.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by applicable law, JobTrail shall not be liable for
              any indirect, incidental, special, or consequential damages arising from your use of
              the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of JobTrail after changes
              are posted constitutes acceptance of the revised Terms. We will update the date below
              when changes are made.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
            <p>
              Questions about these Terms?{" "}
              <a href="mailto:support@jobtrail.app" className="text-primary underline underline-offset-2">
                support@jobtrail.app
              </a>
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Last updated: April 2025 &middot;{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

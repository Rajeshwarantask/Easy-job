import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy | JobTrail",
  description: "How JobTrail collects, uses, and protects your personal data including Gmail access.",
};

export default function PrivacyPage() {
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
            <Shield className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-2xl font-semibold text-foreground">Privacy Policy</h1>
          </div>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Overview</h2>
            <p>
              JobTrail (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;) is a job application tracker that
              automatically detects job-related emails in your Gmail inbox and organises them into a
              personal dashboard. This Privacy Policy explains what data we collect, how we use it,
              and your rights regarding that data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Google account info</strong> — your name, email address, and profile picture, obtained via Google OAuth 2.0 sign-in.</li>
              <li><strong className="text-foreground">Gmail message metadata</strong> — the sender address, subject line, and short preview snippet of emails we identify as job-application related. We never download full email bodies or attachments.</li>
              <li><strong className="text-foreground">Parsed application data</strong> — company name, role title, application status, and dates extracted from email metadata, stored in your account.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Google API and Gmail access</h2>
            <p>
              JobTrail uses the following Google OAuth 2.0 scope exclusively:
            </p>
            <code className="block bg-muted rounded px-3 py-2 text-xs font-mono my-2">
              https://www.googleapis.com/auth/gmail.readonly
            </code>
            <p>
              This scope grants <strong className="text-foreground">read-only</strong> access to your Gmail inbox.
              We use it solely to search for and read job-application emails sent by recruiters, HR systems,
              and job boards. We <strong className="text-foreground">cannot and do not</strong>:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Send emails on your behalf</li>
              <li>Delete or modify any emails</li>
              <li>Access emails unrelated to job applications</li>
              <li>Share your email content with any third party</li>
              <li>Store full email bodies or attachments</li>
            </ul>
            <p>
              JobTrail&apos;s use and transfer of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To build and display your personal job application tracker.</li>
              <li>To generate application statistics, timelines, and insights visible only to you.</li>
              <li>To authenticate your session and identify your account.</li>
            </ul>
            <p>
              We do <strong className="text-foreground">not</strong> sell, rent, trade, or share your personal
              data with any third parties for advertising or any other purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Data storage and security</h2>
            <p>
              Your parsed application data is stored in a secure, encrypted database accessible only to
              your authenticated account. Google OAuth tokens are stored as encrypted HTTP-only cookies
              and are never exposed to the browser or any third party. All data is transmitted over HTTPS.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Data retention and deletion</h2>
            <p>
              Your data is retained only while you have an active account. You can delete your account
              and all associated data from the{" "}
              <Link href="/settings" className="text-primary underline underline-offset-2">
                Settings
              </Link>{" "}
              page at any time. You can also revoke JobTrail&apos;s access to your Google account at any
              time via{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google Account Permissions
              </a>
              . Upon revocation or deletion, all stored OAuth tokens and personal data are permanently
              removed within 30 days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">7. Third-party services</h2>
            <p>
              JobTrail is hosted on <strong className="text-foreground">Vercel</strong>. Authentication is
              provided by <strong className="text-foreground">Google OAuth 2.0</strong> via NextAuth.js.
              No other third-party services receive your personal data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">8. Children&apos;s privacy</h2>
            <p>
              JobTrail is not directed to children under the age of 13. We do not knowingly collect
              personal data from children.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">9. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by updating the date below. Continued use of JobTrail after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">10. Contact</h2>
            <p>
              If you have questions or requests regarding your data, contact us at{" "}
              <a href="mailto:privacy@jobtrail.app" className="text-primary underline underline-offset-2">
                privacy@jobtrail.app
              </a>
              .
            </p>
          </section>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Last updated: April 2025 &middot;{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}

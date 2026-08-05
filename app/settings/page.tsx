import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Privacy-first parsing configuration</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Data Privacy</h2>
          <p className="text-sm text-muted-foreground mt-2">
            JobTrail is a privacy-first application. All parsing happens locally in your browser.
            Gmail is the only source of truth—we never store your data on our servers.
          </p>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium">Session Cache</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Applications are temporarily cached in your browser's sessionStorage during this session.
            The cache is automatically cleared when you close this tab or browser.
          </p>
        </div>

        <div className="border-t pt-4">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="destructive">
              Sign out
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

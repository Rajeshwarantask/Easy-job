import { redirect } from "next/navigation";

// Saved jobs functionality moved to applications dashboard with star filter
export default function SavedJobsPage() {
  redirect("/dashboard/applications?starred=true");
}

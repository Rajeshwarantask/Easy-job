import { redirect } from "next/navigation";

// Job search functionality moved to applications dashboard
export default function JobSearchPage() {
  redirect("/dashboard/applications");
}

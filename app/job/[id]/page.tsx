import { redirect } from "next/navigation";

// Job detail page removed — job info expands inline on /timeline
export default function JobDetailPage() {
  redirect("/timeline");
}

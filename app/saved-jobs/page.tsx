import { SavedJobsClient } from "@/components/job-search/saved-jobs-client";

export const metadata = {
  title: "Saved Jobs | JobTrail",
  description: "Your bookmarked job listings saved for later.",
};

export default function SavedJobsPage() {
  return <SavedJobsClient />;
}

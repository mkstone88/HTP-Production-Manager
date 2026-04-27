import { JobsList } from "@/components/jobs/jobs-list";

export const metadata = { title: "Jobs · HTP" };

export default function JobsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Jobs</h1>
      </div>
      <JobsList />
    </div>
  );
}

import { JobForm } from "@/components/jobs/job-form";

export const metadata = { title: "New job · HTP" };

export default function NewJobPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3 sm:py-4">
        <h1 className="text-lg font-semibold">New job</h1>
      </div>
      <JobForm />
    </div>
  );
}

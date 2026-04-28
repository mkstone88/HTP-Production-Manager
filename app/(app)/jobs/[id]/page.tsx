import { JobDetail } from "@/components/jobs/job-detail";

export const metadata = { title: "Job · HTP" };

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetail id={id} />;
}

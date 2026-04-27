import { SubDetail } from "@/components/subs/sub-detail";

export const metadata = { title: "Subcontractor · HTP" };

export default async function SubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SubDetail id={id} />;
}

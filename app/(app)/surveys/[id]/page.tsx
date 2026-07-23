import { SurveyForm } from "@/components/surveys/survey-form";

export const metadata = { title: "Survey · HTP" };

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SurveyForm surveyId={id} />;
}

import { SubForm } from "@/components/subs/sub-form";

export const metadata = { title: "New subcontractor · HTP" };

export default function NewSubPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <h1 className="text-lg font-semibold">New subcontractor</h1>
      </div>
      <SubForm mode="create" />
    </div>
  );
}

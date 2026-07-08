import { Card } from "@/components/ui/card";

export const metadata = { title: "No access · HTP" };

export default function NoAccessPage() {
  return (
    <div className="p-4 sm:p-6">
      <Card className="mx-auto mt-10 max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">No sections assigned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn&apos;t have any roles yet, so there&apos;s nothing to
          show. Ask an admin to assign you a role from the Users screen.
        </p>
      </Card>
    </div>
  );
}

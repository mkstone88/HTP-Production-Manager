import Link from "next/link";

import { SubsList } from "@/components/subs/subs-list";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Subcontractors · HTP" };

export default function SubsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-semibold">Subcontractors</h1>
        <Link href="/subs/new" className={buttonVariants({ size: "sm" })}>
          Add sub
        </Link>
      </div>
      <SubsList />
    </div>
  );
}

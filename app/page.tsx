import { redirect } from "next/navigation";

import { defaultLanding } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(defaultLanding(session.roles));
}

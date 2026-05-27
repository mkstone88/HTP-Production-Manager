import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The signed-in user (or null). Drives role-aware UI in the app shell. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

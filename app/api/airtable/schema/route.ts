import { NextResponse } from "next/server";

import { airtable, AirtableError } from "@/lib/airtable/client";

export const dynamic = "force-dynamic";

export async function GET() {
  // Dev-only introspection helper; the full base schema has no business being
  // reachable in production.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const schema = await airtable.listTables();
    return NextResponse.json(schema, {
      headers: {
        // Make it easy to download/save: curl ... -o docs/airtable-schema.json
        "Content-Disposition": 'inline; filename="airtable-schema.json"',
      },
    });
  } catch (err) {
    if (err instanceof AirtableError) {
      return NextResponse.json(
        { error: err.message, type: err.type },
        { status: err.status },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { airtable } from "@/lib/airtable/client";
import { errorResponse } from "@/lib/airtable/errors";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/airtable/schema — full base schema (every table, field, option).
 * Admin only: this is a dev/ops introspection tool, and the schema is
 * reconnaissance gold for anyone probing the data APIs.
 */
export async function GET() {
  try {
    await requireAdmin();
    const schema = await airtable.listTables();
    return NextResponse.json(schema, {
      headers: {
        // Make it easy to download/save: curl ... -o docs/airtable-schema.json
        "Content-Disposition": 'inline; filename="airtable-schema.json"',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

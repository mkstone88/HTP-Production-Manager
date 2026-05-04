import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AirtableError } from "./client";

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof AirtableError) {
    return NextResponse.json(
      { error: err.message, type: err.type },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

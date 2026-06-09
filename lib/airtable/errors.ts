import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AirtableError } from "./client";

/** Thrown by the auth guards in lib/session.ts. Maps to a 401/403 response. */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: err.issues },
      { status: 400 },
    );
  }
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof AirtableError) {
    // An Airtable 401/403 means our PAT is bad — a server config problem, not
    // the caller's session. Passed through as-is, the UI would treat the user
    // as logged out.
    const status = err.status === 401 || err.status === 403 ? 502 : err.status;
    return NextResponse.json(
      { error: err.message, type: err.type },
      { status },
    );
  }
  console.error("Unhandled API error:", err);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal error"
      : err instanceof Error
        ? err.message
        : "Unknown error";
  return NextResponse.json({ error: message }, { status: 500 });
}

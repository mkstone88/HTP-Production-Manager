import "server-only";

function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const env = {
  AIRTABLE_PAT: read("AIRTABLE_PAT"),
  AIRTABLE_BASE_ID: read("AIRTABLE_BASE_ID"),
  AUTH_SECRET: read("AUTH_SECRET"),
};

export function requireAirtableEnv() {
  if (!env.AIRTABLE_PAT || !env.AIRTABLE_BASE_ID) {
    throw new Error(
      "Airtable not configured. Set AIRTABLE_PAT and AIRTABLE_BASE_ID in .env.local. See README for instructions.",
    );
  }
  return { pat: env.AIRTABLE_PAT, baseId: env.AIRTABLE_BASE_ID };
}

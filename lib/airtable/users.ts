import "server-only";

import { isRole, type Role } from "@/lib/roles";
import { airtable, type AirtableRecord } from "./client";
import { escapeFormulaValue } from "./formula";
import { tables, userFields } from "./mapping";
import type { AppUser } from "./types";

type UserAirtableFields = Record<string, unknown>;

function optString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

/** Roles from the multi-select, falling back to the legacy admin/user field. */
function rolesFrom(f: UserAirtableFields): Role[] {
  const raw = f[userFields.roles];
  if (Array.isArray(raw) && raw.length > 0) return raw.map(String).filter(isRole);
  const legacy = optString(f[userFields.legacyRole])?.toLowerCase();
  return legacy === "admin" ? ["Admin"] : [];
}

function fromRecord(rec: AirtableRecord<UserAirtableFields>): AppUser {
  const f = rec.fields;
  return {
    id: rec.id,
    name: String(f[userFields.name] ?? ""),
    email: String(f[userFields.email] ?? ""),
    roles: rolesFrom(f),
    active: Boolean(f[userFields.active]),
  };
}

function passwordHashOf(rec: AirtableRecord<UserAirtableFields>): string | undefined {
  return optString(rec.fields[userFields.password]);
}

/** A user plus its (secret) password hash, for auth checks only. */
export type UserWithSecret = { user: AppUser; passwordHash?: string };

export type CreateUserInput = {
  name: string;
  email: string;
  roles: Role[];
  active: boolean;
  passwordHash: string;
};

export type UserPatch = Partial<{
  name: string;
  email: string;
  roles: Role[];
  active: boolean;
  passwordHash: string;
}>;

function toFields(p: CreateUserInput | UserPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out[userFields.name] = p.name;
  if (p.email !== undefined) out[userFields.email] = p.email;
  if (p.roles !== undefined) out[userFields.roles] = p.roles;
  if (p.active !== undefined) out[userFields.active] = p.active;
  if (p.passwordHash !== undefined) out[userFields.password] = p.passwordHash;
  return out;
}


export const UsersRepo = {
  async list(): Promise<AppUser[]> {
    const records = await airtable.listAll<UserAirtableFields>(tables.users);
    return records.map(fromRecord).sort((a, b) => a.name.localeCompare(b.name));
  },

  async get(id: string): Promise<AppUser> {
    return fromRecord(await airtable.get<UserAirtableFields>(tables.users, id));
  },

  async getWithSecret(id: string): Promise<UserWithSecret> {
    const rec = await airtable.get<UserAirtableFields>(tables.users, id);
    return { user: fromRecord(rec), passwordHash: passwordHashOf(rec) };
  },

  async findByEmailWithSecret(email: string): Promise<UserWithSecret | null> {
    const formula = `LOWER({${userFields.email}}) = "${escapeFormulaValue(email.toLowerCase(), '"')}"`;
    const records = await airtable.listAll<UserAirtableFields>(tables.users, {
      filterByFormula: formula,
      pageSize: 1,
      maxRecords: 1,
    });
    const rec = records[0];
    return rec ? { user: fromRecord(rec), passwordHash: passwordHashOf(rec) } : null;
  },

  async create(input: CreateUserInput): Promise<AppUser> {
    return fromRecord(
      await airtable.create<UserAirtableFields>(tables.users, toFields(input)),
    );
  },

  async update(id: string, patch: UserPatch): Promise<AppUser> {
    return fromRecord(
      await airtable.update<UserAirtableFields>(tables.users, id, toFields(patch)),
    );
  },

  async delete(id: string): Promise<void> {
    await airtable.delete(tables.users, id);
  },
};

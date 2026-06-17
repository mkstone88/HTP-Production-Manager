/**
 * Edge- and Node-compatible auth primitives.
 * Uses Web Crypto (crypto.subtle) so the same code runs in Next.js middleware
 * (Edge runtime) and in route handlers (Node runtime).
 *
 * Two responsibilities:
 *  1. Signed session cookies that carry the user's id + role (HMAC-SHA256).
 *  2. Password hashing/verification (PBKDF2-SHA256) for the App Users table.
 */

const SESSION_COOKIE = "htp_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export { SESSION_COOKIE };

export type SessionRole = "admin" | "user";
const ROLES: readonly SessionRole[] = ["admin", "user"];

function getSecretRaw(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 16 chars in .env.local",
    );
  }
  return s;
}

const enc = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey(getSecretRaw());
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(new Uint8Array(sig));
}

/** Identity carried inside the signed session cookie. */
export type Session = { uid: string; role: SessionRole; iat: number; exp: number };

export async function issueSession(input: {
  uid: string;
  role: SessionRole;
}): Promise<{ token: string; expiresAt: Date }> {
  const iat = Date.now();
  const exp = iat + SESSION_TTL_MS;
  // uid (Airtable rec id) and role contain no dots, so a dot-delimited token is safe.
  const payload = `${input.uid}.${input.role}.${iat}.${exp}`;
  const sig = await sign(payload);
  return { token: `${payload}.${sig}`, expiresAt: new Date(exp) };
}

export async function verifySession(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [uid, role, iatStr, expStr, sig] = parts;
  if (!ROLES.includes(role as SessionRole)) return null;
  const expectedSig = await sign(`${uid}.${role}.${iatStr}.${expStr}`);
  if (!timingSafeEqualHex(sig, expectedSig)) return null;
  const iat = Number(iatStr);
  const exp = Number(expStr);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;
  return { uid, role: role as SessionRole, iat, exp };
}

// ---- Password hashing (PBKDF2-SHA256) ---------------------------------------
// Stored format: `pbkdf2$<iterations>$<saltHex>$<hashHex>`. Self-describing so
// the iteration count can be raised later without breaking existing hashes.

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32;
const PBKDF2_SALT_BYTES = 16;

async function pbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
  lenBytes: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    lenBytes * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const salt = hexToBytes(parts[2]);
  const expectedHex = parts[3];
  const actualHex = toHex(
    await pbkdf2(password, salt, iterations, expectedHex.length / 2),
  );
  return timingSafeEqualHex(actualHex, expectedHex);
}

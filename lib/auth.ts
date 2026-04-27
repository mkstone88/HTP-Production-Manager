/**
 * Edge- and Node-compatible passcode auth.
 * Uses Web Crypto (SubtleCrypto + crypto.subtle) so the same code runs in
 * Next.js middleware (Edge runtime) and in route handlers (Node runtime).
 */

const SESSION_COOKIE = "htp_session";
const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export { SESSION_COOKIE };

function getSecretRaw(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 16 chars in .env.local",
    );
  }
  return s;
}

function getPasscodeRaw(): string {
  const p = process.env.ADMIN_PASSCODE;
  if (!p) {
    throw new Error(
      "ADMIN_PASSCODE not set. Add it to .env.local — see README.",
    );
  }
  return p;
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

function bytesToHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    out += arr[i].toString(16).padStart(2, "0");
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
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
  return bytesToHex(sig);
}

export type Session = { iat: number; exp: number };

export async function issueSession(): Promise<{ token: string; expiresAt: Date }> {
  const iat = Date.now();
  const exp = iat + SESSION_TTL_MS;
  const payload = `${iat}.${exp}`;
  const sig = await sign(payload);
  return { token: `${payload}.${sig}`, expiresAt: new Date(exp) };
}

export async function verifySession(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [iatStr, expStr, sig] = parts;
  const expectedSig = await sign(`${iatStr}.${expStr}`);
  if (!timingSafeEqualHex(sig, expectedSig)) return null;
  const iat = Number(iatStr);
  const exp = Number(expStr);
  if (!Number.isFinite(iat) || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;
  return { iat, exp };
}

export function checkPasscode(input: string): boolean {
  const expected = getPasscodeRaw();
  // Constant-time compare on equal-length strings.
  if (input.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < input.length; i++) {
    mismatch |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// Quiet TS unused-symbol warnings when one of these helpers isn't yet in use.
void hexToBytes;

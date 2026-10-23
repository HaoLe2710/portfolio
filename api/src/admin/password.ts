// Cloudflare Workers currently rejects Web Crypto PBKDF2 values above 100,000.
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_BYTES = 32;
const SALT_BYTES = 16;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(size = 32) {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(size)));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number) {
  const saltBuffer = new ArrayBuffer(salt.length);
  new Uint8Array(saltBuffer).set(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations },
    key,
    PASSWORD_BYTES * 8
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  let mismatch = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (first[index] ?? 0) ^ (second[index] ?? 0);
  }
  return mismatch === 0;
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return {
    salt: toBase64Url(salt),
    hash: toBase64Url(await derivePasswordHash(password, salt, PASSWORD_ITERATIONS)),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  saltEncoded: string,
  hashEncoded: string,
  iterations: number
) {
  if (!Number.isInteger(iterations) || iterations !== PASSWORD_ITERATIONS) {
    return false;
  }
  try {
    return constantTimeEqual(
      await derivePasswordHash(password, fromBase64Url(saltEncoded), iterations),
      fromBase64Url(hashEncoded)
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_password_hash_verification_error",
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message.slice(0, 160) : "Unknown error",
    }));
    return false;
  }
}

export const DUMMY_PASSWORD_HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
export const DUMMY_PASSWORD_SALT = "AAAAAAAAAAAAAAAAAAAAAA";
export const CURRENT_PASSWORD_ITERATIONS = PASSWORD_ITERATIONS;

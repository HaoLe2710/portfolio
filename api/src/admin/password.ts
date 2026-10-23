import setupWasm, { type computeHash } from "argon2id/lib/setup.js";
import argon2idNoSimdModule from "argon2id/dist/no-simd.wasm";
import argon2idSimdModule from "argon2id/dist/simd.wasm";
import {
  ARGON2_PARAMETERS,
  CURRENT_PASSWORD_ALGORITHM,
  LEGACY_PASSWORD_ALGORITHM,
  LEGACY_PASSWORD_ITERATIONS,
  PASSWORD_BYTES,
  SALT_BYTES,
} from "./password-profile";

export { CURRENT_PASSWORD_ALGORITHM, LEGACY_PASSWORD_ALGORITHM, LEGACY_PASSWORD_ITERATIONS };

let argon2idPromise: Promise<computeHash> | null = null;
let argon2idQueue: Promise<void> = Promise.resolve();

function loadWasmModule(module: WebAssembly.Module) {
  return async (imports: WebAssembly.Imports): Promise<WebAssembly.WebAssemblyInstantiatedSource> => ({
    module,
    instance: await WebAssembly.instantiate(module, imports),
  });
}

function getArgon2id() {
  argon2idPromise ??= setupWasm(
    loadWasmModule(argon2idSimdModule),
    loadWasmModule(argon2idNoSimdModule)
  );
  return argon2idPromise;
}

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

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  let mismatch = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (first[index] ?? 0) ^ (second[index] ?? 0);
  }
  return mismatch === 0;
}

async function deriveArgon2id(password: string, salt: Uint8Array) {
  const passwordBytes = new TextEncoder().encode(password);
  const previous = argon2idQueue;
  let release: () => void = () => undefined;
  argon2idQueue = new Promise<void>((resolve) => { release = resolve; });
  try {
    await previous;
    return await (await getArgon2id())({ password: passwordBytes, salt, ...ARGON2_PARAMETERS });
  } finally {
    release();
    passwordBytes.fill(0);
  }
}

async function deriveLegacyPasswordHash(password: string, salt: Uint8Array, iterations: number) {
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

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  try {
    return {
      algorithm: CURRENT_PASSWORD_ALGORITHM,
      salt: toBase64Url(salt),
      hash: toBase64Url(await deriveArgon2id(password, salt)),
      // Kept at the legacy schema minimum until the compatibility column is removed.
      iterations: LEGACY_PASSWORD_ITERATIONS,
    };
  } finally {
    salt.fill(0);
  }
}

export async function verifyPassword(
  password: string,
  saltEncoded: string,
  hashEncoded: string,
  iterations: number,
  algorithm: string = LEGACY_PASSWORD_ALGORITHM
) {
  if (algorithm === CURRENT_PASSWORD_ALGORITHM) {
    try {
      return constantTimeEqual(
        await deriveArgon2id(password, fromBase64Url(saltEncoded)),
        fromBase64Url(hashEncoded)
      );
    } catch (error) {
      console.error(JSON.stringify({
        event: "admin_password_hash_verification_error",
        algorithm,
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message.slice(0, 160) : "Unknown error",
      }));
      return false;
    }
  }

  if (algorithm !== LEGACY_PASSWORD_ALGORITHM || iterations !== LEGACY_PASSWORD_ITERATIONS) {
    return false;
  }
  try {
    return constantTimeEqual(
      await deriveLegacyPasswordHash(password, fromBase64Url(saltEncoded), iterations),
      fromBase64Url(hashEncoded)
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "admin_password_hash_verification_error",
      algorithm,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message.slice(0, 160) : "Unknown error",
    }));
    return false;
  }
}

export const DUMMY_PASSWORD_HASH = toBase64Url(new Uint8Array(PASSWORD_BYTES));
export const DUMMY_PASSWORD_SALT = toBase64Url(new Uint8Array(SALT_BYTES));

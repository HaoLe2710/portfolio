import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import setupWasm, { type computeHash } from "argon2id/lib/setup.js";
import { ARGON2_PARAMETERS, CURRENT_PASSWORD_ALGORITHM, LEGACY_PASSWORD_ITERATIONS, SALT_BYTES } from "../src/admin/password-profile";

export const NODE_PASSWORD_ALGORITHM = CURRENT_PASSWORD_ALGORITHM;

let computeHashPromise: Promise<computeHash> | null = null;

async function getComputeHash() {
  computeHashPromise ??= (async () => {
    const [simd, noSimd] = await Promise.all([
      readFile(fileURLToPath(import.meta.resolve("argon2id/dist/simd.wasm"))),
      readFile(fileURLToPath(import.meta.resolve("argon2id/dist/no-simd.wasm"))),
    ]);
    const [simdModule, noSimdModule] = await Promise.all([
      WebAssembly.compile(new Uint8Array(simd)),
      WebAssembly.compile(new Uint8Array(noSimd)),
    ]);
    const load = (module: WebAssembly.Module) => async (imports: WebAssembly.Imports) => ({
      module,
      instance: await WebAssembly.instantiate(module, imports),
    });
    return setupWasm(load(simdModule), load(noSimdModule));
  })();
  return computeHashPromise;
}

function toBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export async function hashPasswordNode(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const passwordBytes = new TextEncoder().encode(password);
  try {
    const hash = await (await getComputeHash())({
      password: passwordBytes,
      salt,
      ...ARGON2_PARAMETERS,
    });
    return {
      algorithm: NODE_PASSWORD_ALGORITHM,
      salt: toBase64Url(salt),
      hash: toBase64Url(hash),
      // Kept populated for the existing admin_users schema CHECK constraint.
      iterations: LEGACY_PASSWORD_ITERATIONS,
    };
  } finally {
    passwordBytes.fill(0);
    salt.fill(0);
  }
}

export const LEGACY_PASSWORD_ALGORITHM = "pbkdf2-sha256" as const;
export const CURRENT_PASSWORD_ALGORITHM = "argon2id-v19-m19456-t2-p1" as const;
export const LEGACY_PASSWORD_ITERATIONS = 100_000;
export const PASSWORD_BYTES = 32;
export const SALT_BYTES = 16;

export const ARGON2_PARAMETERS = {
  memorySize: 19_456,
  passes: 2,
  parallelism: 1,
  tagLength: PASSWORD_BYTES,
} as const;

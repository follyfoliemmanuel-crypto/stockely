import { hash, verify } from "@node-rs/argon2";

/**
 * Paramètres Argon2id conformes aux recommandations OWASP (2024+) :
 * 19 MiB de mémoire, 2 itérations, 1 thread.
 * Le sel est généré automatiquement et inclus dans l'empreinte.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

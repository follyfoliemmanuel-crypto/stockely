import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { loginAttempts } from "@/server/db/schema";
import { ApiError } from "@/server/http";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;

const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP = 5;
/**
 * Préfixe réservé : les tentatives d'inscription sont journalisées dans la
 * même table que les connexions, mais avec un e-mail sentinelle qui ne peut
 * jamais correspondre à une adresse réelle. Le champ `ipHash` reste NULL
 * pour ne pas impacter la limite de connexion par IP.
 */
const REGISTRATION_SENTINEL = "__stockely_registration__:";

async function countFailures(
  field: "email" | "ipHash",
  value: string,
  since: Date,
): Promise<number> {
  const column = field === "email" ? loginAttempts.email : loginAttempts.ipHash;
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(column, value),
        eq(loginAttempts.succeeded, false),
        gte(loginAttempts.createdAt, since),
      ),
    );

  return rows[0]?.total ?? 0;
}

/**
 * Limitation persistée en base : elle résiste aux redémarrages et
 * fonctionne même avec plusieurs instances serverless.
 */
export async function assertLoginAllowed(email: string, ipHash: string): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MS);
  const normalizedEmail = email.trim().toLowerCase();

  const [emailFailures, ipFailures] = await Promise.all([
    countFailures("email", normalizedEmail, since),
    countFailures("ipHash", ipHash, since),
  ]);

  if (emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP) {
    throw new ApiError(
      429,
      "too_many_attempts",
      "Trop de tentatives de connexion. Réessayez dans quelques minutes.",
    );
  }
}

export async function recordLoginAttempt(
  email: string,
  ipHash: string,
  succeeded: boolean,
): Promise<void> {
  await getDb().insert(loginAttempts).values({
    email: email.trim().toLowerCase(),
    ipHash,
    succeeded,
  });
}

/**
 * Limite les créations de comptes par adresse IP.
 * Sans cette barrière, une inscription automatisée peut créer un nombre
 * illimité de boutiques et saturer la base.
 */
export async function assertRegistrationAllowed(ipHash: string): Promise<void> {
  const since = new Date(Date.now() - REGISTRATION_WINDOW_MS);
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, `${REGISTRATION_SENTINEL}${ipHash}`),
        gte(loginAttempts.createdAt, since),
      ),
    );

  if ((rows[0]?.total ?? 0) >= MAX_REGISTRATIONS_PER_IP) {
    throw new ApiError(
      429,
      "too_many_registrations",
      "Trop de créations de compte depuis cette adresse. Réessayez plus tard.",
    );
  }
}

export async function recordRegistrationAttempt(ipHash: string): Promise<void> {
  await getDb().insert(loginAttempts).values({
    email: `${REGISTRATION_SENTINEL}${ipHash}`,
    ipHash: null,
    succeeded: false,
  });
}

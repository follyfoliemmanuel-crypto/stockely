import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import { loginAttempts } from "@/server/db/schema";
import { ApiError } from "@/server/http";

/**
 * Les requêtes IA sont journalisées dans `login_attempts` sous un préfixe
 * réservé : cela évite une migration supplémentaire tout en bénéficiant d'une
 * limitation persistée, partagée entre instances serverless.
 *
 * Le préfixe ne peut jamais correspondre à une adresse e-mail réelle et les
 * lignes sont marquées comme réussies : elles n'affectent donc pas la
 * limitation des tentatives de connexion, qui ne compte que les échecs.
 */
const AI_SENTINEL = "__stockely_ai__:";
const BURST_WINDOW_MS = 60 * 1000;
const BURST_MAX = 5;
const WINDOW_MS = 60 * 60 * 1000;
const WINDOW_MAX = 30;

async function countRequests(key: string, since: Date): Promise<number> {
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.email, key), gte(loginAttempts.createdAt, since)),
    );

  return rows[0]?.total ?? 0;
}

export async function assertAiAllowed(userId: string): Promise<void> {
  const key = `${AI_SENTINEL}${userId}`;
  const [burst, hourly] = await Promise.all([
    countRequests(key, new Date(Date.now() - BURST_WINDOW_MS)),
    countRequests(key, new Date(Date.now() - WINDOW_MS)),
  ]);

  if (burst >= BURST_MAX) {
    throw new ApiError(
      429,
      "ai_rate_limited",
      "Trop de demandes en peu de temps. Patientez une minute puis réessayez.",
    );
  }
  if (hourly >= WINDOW_MAX) {
    throw new ApiError(
      429,
      "ai_rate_limited",
      "Vous avez atteint la limite horaire de l'assistant IA. Réessayez plus tard.",
    );
  }
}

export async function recordAiRequest(userId: string): Promise<void> {
  await getDb().insert(loginAttempts).values({
    email: `${AI_SENTINEL}${userId}`,
    ipHash: null,
    succeeded: true,
  });
}

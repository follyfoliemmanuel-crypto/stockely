import { and, eq, gte, sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { writeAudit } from "@/server/audit";
import {
  EMAIL_VERIFICATION_LIFETIME_MINUTES,
  createEmailVerificationToken,
  readEmailVerificationToken,
} from "@/server/auth/email-verification";
import { getDb } from "@/server/db";
import { loginAttempts, users } from "@/server/db/schema";
import { isEmailConfigured, sendEmailVerificationEmail } from "@/server/email";
import { ApiError } from "@/server/http";

const RESEND_SENTINEL = "__stockely_verify__:";
const MAX_RESENDS_PER_HOUR = 3;

export interface VerificationRecipient {
  id: string;
  email: string;
  name: string;
}

function buildVerifyUrl(token: string): string {
  const appUrl = getEnv().APP_URL;
  const base = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  // Le jeton reste dans le fragment : il n'est jamais envoyé au serveur lors
  // du chargement de la page, donc absent des journaux et du Referer.
  const url = new URL("verify-email", base);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

/**
 * Envoie l'e-mail de confirmation d'adresse via Resend.
 * Sans configuration e-mail, la fonction ne fait rien : l'inscription reste
 * utilisable, mais aucun e-mail n'est simulé.
 */
export async function sendVerificationEmail(
  user: VerificationRecipient,
): Promise<void> {
  if (!isEmailConfigured()) return;

  const token = createEmailVerificationToken(user);
  await sendEmailVerificationEmail({
    to: user.email,
    name: user.name,
    verifyUrl: buildVerifyUrl(token),
    expiresInMinutes: EMAIL_VERIFICATION_LIFETIME_MINUTES,
  });
}

/** Renvoi à la demande d'un utilisateur connecté, limité à 3 par heure. */
export async function resendVerificationEmail(
  user: VerificationRecipient,
  ipHash: string,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new ApiError(
      503,
      "email_not_configured",
      "L'envoi d'e-mails n'est pas configuré sur cette installation.",
    );
  }

  const db = getDb();
  const key = `${RESEND_SENTINEL}${user.id}`;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recent = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(
      and(eq(loginAttempts.email, key), gte(loginAttempts.createdAt, oneHourAgo)),
    );

  if ((recent[0]?.total ?? 0) >= MAX_RESENDS_PER_HOUR) {
    throw new ApiError(
      429,
      "too_many_requests",
      "Trop de demandes. Réessayez dans une heure.",
    );
  }

  // La tentative est comptée avant l'envoi pour éviter les rafales.
  await db.insert(loginAttempts).values({ email: key, ipHash, succeeded: true });

  try {
    await sendVerificationEmail(user);
  } catch {
    // Aucun contenu d'e-mail, jeton ou secret n'est journalisé.
    console.error("[stockely] échec d'envoi de l'e-mail de vérification");
    throw new ApiError(
      502,
      "email_failed",
      "L'envoi de l'e-mail a échoué. Réessayez plus tard.",
    );
  }

  await writeAudit(db, {
    shopId: null,
    userId: user.id,
    action: "auth.email_verification_requested",
    entityType: "user",
    entityId: user.id,
    ipHash,
  });
}

/**
 * Confirme l'adresse e-mail à partir du jeton signé.
 * L'opération est idempotente : un lien déjà utilisé reste sans effet.
 */
export async function verifyEmail(token: string, ipHash: string): Promise<void> {
  const claims = readEmailVerificationToken(token);
  if (!claims) {
    throw new ApiError(
      400,
      "invalid_verification_token",
      "Ce lien de vérification est invalide ou a expiré.",
    );
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, claims.userId))
    .limit(1);

  const user = rows[0];
  if (!user || user.email.trim().toLowerCase() !== claims.email) {
    throw new ApiError(
      400,
      "invalid_verification_token",
      "Ce lien ne correspond à aucun compte.",
    );
  }

  if (user.emailVerifiedAt) return;

  const now = new Date();
  await db
    .update(users)
    .set({ emailVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, user.id));

  await writeAudit(db, {
    shopId: null,
    userId: user.id,
    action: "auth.email_verified",
    entityType: "user",
    entityId: user.id,
    ipHash,
  });
}

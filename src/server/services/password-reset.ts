import { randomBytes } from "node:crypto";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { writeAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { hashToken } from "@/server/auth/session";
import { getDb, type Database } from "@/server/db";
import { passwordResetTokens, sessions, users } from "@/server/db/schema";
import { isEmailConfigured, sendPasswordResetEmail } from "@/server/email";
import { ApiError } from "@/server/http";

const TOKEN_LIFETIME_MINUTES = 60;
const MAX_REQUESTS_PER_USER_PER_HOUR = 3;
const MAX_REQUESTS_PER_IP_PER_HOUR = 10;

/**
 * Demande de réinitialisation.
 * La réponse est identique que le compte existe ou non (anti-énumération).
 * Sans fournisseur d'e-mail configuré, l'API répond explicitement 503.
 */
export async function requestPasswordReset(
  email: string,
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
  const env = getEnv();
  const normalizedEmail = email.trim().toLowerCase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const ipRequests = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.ipHash, ipHash),
        gte(passwordResetTokens.createdAt, oneHourAgo),
      ),
    );

  if ((ipRequests[0]?.total ?? 0) >= MAX_REQUESTS_PER_IP_PER_HOUR) {
    throw new ApiError(
      429,
      "too_many_requests",
      "Trop de demandes. Réessayez dans quelques minutes.",
    );
  }

  const userRows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  const user = userRows[0];
  if (!user) return;

  const recent = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        gte(passwordResetTokens.createdAt, oneHourAgo),
      ),
    );

  if ((recent[0]?.total ?? 0) >= MAX_REQUESTS_PER_USER_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MINUTES * 60 * 1000);

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    ipHash,
    expiresAt,
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: TOKEN_LIFETIME_MINUTES,
    });
  } catch {
    // On ne révèle jamais l'existence du compte ni le détail de l'échec.
    // Aucun contenu d'e-mail, jeton ou secret n'est journalisé.
    console.error("[stockely] échec d'envoi du lien de réinitialisation");
    return;
  }

  await writeAudit(db, {
    shopId: null,
    userId: user.id,
    action: "auth.password_reset_requested",
    entityType: "user",
    entityId: user.id,
    ipHash,
  });
}

/**
 * Applique un nouveau mot de passe.
 * Le jeton est à usage unique, le mot de passe est haché, toutes les sessions
 * existantes sont révoquées et l'opération est auditée.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  ipHash: string,
): Promise<void> {
  const db = getDb();
  const tokenHash = hashToken(token);
  const now = new Date();

  const rows = await db
    .select({ reset: passwordResetTokens, user: users })
    .from(passwordResetTokens)
    .innerJoin(users, eq(users.id, passwordResetTokens.userId))
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gte(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ApiError(
      400,
      "invalid_reset_token",
      "Ce lien est invalide ou a expiré. Demandez un nouveau lien.",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, row.user.id),
          isNull(passwordResetTokens.usedAt),
        ),
      );

    await tx
      .update(users)
      .set({
        passwordHash,
        updatedAt: now,
        emailVerifiedAt: row.user.emailVerifiedAt ?? now,
      })
      .where(eq(users.id, row.user.id));

    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, row.user.id), isNull(sessions.revokedAt)));

    await writeAudit(tx as unknown as Database, {
      shopId: null,
      userId: row.user.id,
      action: "auth.password_reset_completed",
      entityType: "user",
      entityId: row.user.id,
      ipHash,
    });
  });
}

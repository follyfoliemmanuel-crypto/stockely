import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  assertRegistrationAllowed,
  recordRegistrationAttempt,
} from "@/server/auth/rate-limit";
import { generateToken, hashToken } from "@/server/auth/session";
import { getDb, getPool } from "@/server/db";
import {
  auditLogs,
  passwordResetTokens,
  sessions,
  users,
} from "@/server/db/schema";
import { requestPasswordReset, resetPassword } from "@/server/services/password-reset";

const mail = vi.hoisted(() => ({
  sent: [] as Array<{
    to: string;
    name: string;
    resetUrl: string;
    expiresInMinutes: number;
  }>,
}));

vi.mock("@/server/email", () => ({
  isEmailConfigured: () => true,
  sendPasswordResetEmail: async (input: (typeof mail.sent)[number]) => {
    mail.sent.push(input);
  },
}));

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

/**
 * Ces tests écrivent dans la base TEST_DATABASE_URL (jamais la base de
 * développement). Sans cette variable, ils sont ignorés.
 */
describe.skipIf(!hasTestDatabase)("réinitialisation du mot de passe (intégration)", () => {
  const db = getDb();

  beforeEach(() => {
    mail.sent.length = 0;
  });

  afterAll(async () => {
    await getPool().end();
  });

  async function createUser(label: string) {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const email = `reset-${label}-${suffix}@example.test`;
    const [user] = await db
      .insert(users)
      .values({
        email,
        name: `Test ${label}`,
        passwordHash: await hashPassword("ancien-secret-2026"),
      })
      .returning();

    if (!user) throw new Error("Utilisateur de test non créé");
    return user;
  }

  it("consomme le jeton une seule fois et révoque les sessions", async () => {
    const user = await createUser("one-time");
    const ipHash = `test-ip-${randomUUID()}`;

    const [session] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        activeShopId: null,
        tokenHash: hashToken(generateToken()),
        csrfToken: generateToken(),
        ipHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning();

    if (!session) throw new Error("Session de test non créée");

    await requestPasswordReset(user.email, ipHash);

    expect(mail.sent).toHaveLength(1);
    const resetUrl = new URL(mail.sent[0]!.resetUrl);
    const rawToken = resetUrl.searchParams.get("token");
    expect(rawToken).toBeTruthy();

    const storedTokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    expect(storedTokens).toHaveLength(1);
    expect(storedTokens[0]!.tokenHash).not.toBe(rawToken);
    expect(storedTokens[0]!.tokenHash).toBe(hashToken(rawToken!));

    await resetPassword(rawToken!, "nouveau-secret-2026", ipHash);

    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    await expect(
      verifyPassword(updatedUser!.passwordHash!, "nouveau-secret-2026"),
    ).resolves.toBe(true);

    const [revokedSession] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(revokedSession!.revokedAt).not.toBeNull();

    const [usedToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, storedTokens[0]!.id));
    expect(usedToken!.usedAt).not.toBeNull();

    const auditActions = (
      await db
        .select({ action: auditLogs.action })
        .from(auditLogs)
        .where(eq(auditLogs.userId, user.id))
    ).map((row) => row.action);
    expect(auditActions).toEqual(
      expect.arrayContaining([
        "auth.password_reset_requested",
        "auth.password_reset_completed",
      ]),
    );

    await expect(
      resetPassword(rawToken!, "encore-un-secret-2026", ipHash),
    ).rejects.toMatchObject({ status: 400, code: "invalid_reset_token" });
  });

  it("refuse deux réinitialisations concurrentes avec le même jeton", async () => {
    const user = await createUser("concurrent");
    const ipHash = `test-ip-${randomUUID()}`;

    await requestPasswordReset(user.email, ipHash);
    expect(mail.sent).toHaveLength(1);
    const rawToken = new URL(mail.sent[0]!.resetUrl).searchParams.get("token");
    expect(rawToken).toBeTruthy();

    const results = await Promise.allSettled([
      resetPassword(rawToken!, "premier-secret-2026", ipHash),
      resetPassword(rawToken!, "second-secret-2026", ipHash),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: { status: 400, code: "invalid_reset_token" },
    });

    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    const acceptedPassword = await Promise.all([
      verifyPassword(updatedUser!.passwordHash!, "premier-secret-2026"),
      verifyPassword(updatedUser!.passwordHash!, "second-secret-2026"),
    ]);
    expect(acceptedPassword.filter(Boolean)).toHaveLength(1);
  });

  it("ne révèle rien et n'envoie rien pour un compte inconnu", async () => {
    const ipHash = `test-ip-${randomUUID()}`;
    await expect(
      requestPasswordReset(`inconnu-${randomUUID()}@example.test`, ipHash),
    ).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });

  it("refuse un jeton expiré", async () => {
    const user = await createUser("expired");
    const rawToken = generateToken();

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      ipHash: `test-ip-${randomUUID()}`,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      resetPassword(rawToken, "nouveau-secret-2026", `test-ip-${randomUUID()}`),
    ).rejects.toMatchObject({ status: 400, code: "invalid_reset_token" });
  });

  it("limite à trois demandes par compte et par heure", async () => {
    const user = await createUser("limit");
    const ipHash = `test-ip-${randomUUID()}`;

    for (let index = 0; index < 3; index += 1) {
      await requestPasswordReset(user.email, ipHash);
    }
    await requestPasswordReset(user.email, ipHash);

    expect(mail.sent).toHaveLength(3);
  });

  it("limite les créations de compte par adresse IP", async () => {
    const ipHash = `test-register-ip-${randomUUID()}`;

    for (let index = 0; index < 5; index += 1) {
      await expect(assertRegistrationAllowed(ipHash)).resolves.toBeUndefined();
      await recordRegistrationAttempt(ipHash);
    }

    await expect(assertRegistrationAllowed(ipHash)).rejects.toMatchObject({
      status: 429,
      code: "too_many_registrations",
    });
  });
});

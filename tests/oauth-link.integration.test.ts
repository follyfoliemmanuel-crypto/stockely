import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { hashPassword } from "@/server/auth/password";
import { generateToken, hashToken } from "@/server/auth/session";
import { getDb, closePool } from "@/server/db";
import {
  authIdentities,
  memberships,
  sessions,
  shops,
  users,
  warehouses,
} from "@/server/db/schema";
import { loginWithGoogle } from "@/server/services/oauth";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

/**
 * Empêche la pré-création de compte : lorsqu'un e-mail enregistré mais non
 * vérifié est repris via Google (e-mail vérifié par Google), le mot de passe
 * inconnu et les sessions existantes doivent être neutralisés.
 */
describe.skipIf(!hasTestDatabase)("liaison Google d'un compte non vérifié", () => {
  const db = getDb();

  afterAll(async () => {
    await closePool();
  });

  it("révoque le mot de passe et les sessions existantes", async () => {
    const suffix = `${Date.now()}-${randomUUID()}`;
    const email = `prehijack-${suffix}@example.test`;
    const ipHash = `test-ip-${randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        email,
        name: "Compte non vérifié",
        passwordHash: await hashPassword("mot-de-passe-attaquant-2026"),
      })
      .returning();
    if (!user) throw new Error("Utilisateur non créé");

    const [shop] = await db
      .insert(shops)
      .values({
        name: `Boutique ${suffix}`,
        slug: `prehijack-${suffix}`,
        currency: "XOF",
        timezone: "Africa/Lome",
      })
      .returning();
    if (!shop) throw new Error("Boutique non créée");

    await db.insert(memberships).values({
      shopId: shop.id,
      userId: user.id,
      role: "owner",
    });

    const [existingSession] = await db
      .insert(sessions)
      .values({
        userId: user.id,
        activeShopId: shop.id,
        tokenHash: hashToken(generateToken()),
        csrfToken: generateToken(),
        ipHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .returning();
    if (!existingSession) throw new Error("Session non créée");

    const result = await loginWithGoogle(
      {
        sub: `google-sub-${suffix}`,
        email,
        name: "Propriétaire vérifié",
        picture: null,
      },
      { ipHash, userAgent: "vitest" },
    );

    expect(result.user.id).toBe(user.id);
    expect(result.user.emailVerifiedAt).not.toBeNull();
    expect(result.user.passwordHash).toBeNull();

    const [revoked] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, existingSession.id));
    expect(revoked?.revokedAt).not.toBeNull();

    const identities = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, user.id));
    expect(identities).toHaveLength(1);
    expect(identities[0]?.provider).toBe("google");

    // Une boutique sans entrepôt rendait le tableau de bord inutilisable :
    // la connexion doit désormais en créer un automatiquement.
    const warehouseRows = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.shopId, shop.id));
    expect(warehouseRows).toHaveLength(1);
    expect(warehouseRows[0]?.isDefault).toBe(true);
  });
});

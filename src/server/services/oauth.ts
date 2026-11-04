import { and, eq, isNull, sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { writeAudit } from "@/server/audit";
import { createSession, type CreatedSession } from "@/server/auth/session";
import { getDb, type Database } from "@/server/db";
import {
  authIdentities,
  memberships,
  saleCounters,
  sessions,
  shopSettings,
  shops,
  users,
  warehouses,
  type MemberRole,
  type Shop,
  type User,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import type { GoogleProfile } from "@/server/auth/oauth";
import { ensureDefaultWarehouse, uniqueSlug } from "./auth";

export interface GoogleLoginResult {
  user: User;
  shop: Shop;
  role: MemberRole;
  session: CreatedSession;
  isNewUser: boolean;
}

interface RequestMeta {
  ipHash: string;
  userAgent: string | null;
}

async function createDefaultShop(
  tx: Database,
  user: User,
  shopName: string,
): Promise<Shop> {
  const env = getEnv();
  const slug = await uniqueSlug(shopName);

  const [shop] = await tx
    .insert(shops)
    .values({
      name: shopName.slice(0, 120),
      slug,
      currency: env.DEFAULT_CURRENCY,
      timezone: env.DEFAULT_TIMEZONE,
    })
    .returning();

  if (!shop) throw new Error("Création de la boutique impossible");

  await tx.insert(memberships).values({
    shopId: shop.id,
    userId: user.id,
    role: "owner",
  });
  await tx.insert(shopSettings).values({ shopId: shop.id });
  await tx.insert(saleCounters).values({ shopId: shop.id });
  // Sans entrepôt, le tableau de bord et les ventes sont inutilisables.
  await tx.insert(warehouses).values({
    shopId: shop.id,
    name: "Entrepôt principal",
    code: "MAIN",
    isDefault: true,
    isActive: true,
  });

  return shop;
}

/**
 * Connexion Google.
 * - Un compte existant est relié à l'identité Google si l'e-mail est vérifié.
 * - Un nouvel utilisateur obtient une boutique dont il est propriétaire.
 * La boutique active est ensuite résolue par adhésion, comme pour la connexion classique.
 */
export async function loginWithGoogle(
  profile: GoogleProfile,
  meta: RequestMeta,
): Promise<GoogleLoginResult> {
  const db = getDb();

  const identityRows = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(
      and(
        eq(authIdentities.provider, "google"),
        eq(authIdentities.providerAccountId, profile.sub),
      ),
    )
    .limit(1);

  let user = identityRows[0]?.user;
  let isNewUser = false;

  if (!user) {
    const byEmail = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${profile.email}`)
      .limit(1);

    const existing = byEmail[0];

    if (existing) {
      // L'e-mail Google est vérifié : la liaison est sûre. L'identité et la
      // reprise du compte sont écrites dans la même transaction pour qu'un
      // échec ne laisse jamais une identité liée sans révocation du mot de
      // passe existant.
      const now = new Date();
      let linkedUser = existing;
      await db.transaction(async (tx) => {
        await tx
          .insert(authIdentities)
          .values({
            userId: existing.id,
            provider: "google",
            providerAccountId: profile.sub,
          })
          .onConflictDoNothing();

        if (!existing.emailVerifiedAt) {
          // Compte créé par mot de passe mais jamais vérifié : un tiers a pu
          // enregistrer l'adresse avant son propriétaire. Google prouve ici
          // la propriété de l'e-mail, donc on reprend le compte : le mot de
          // passe inconnu est supprimé et toutes les sessions existantes sont
          // révoquées, ce qui neutralise une pré-création malveillante.
          const [updated] = await tx
            .update(users)
            .set({ emailVerifiedAt: now, passwordHash: null, updatedAt: now })
            .where(eq(users.id, existing.id))
            .returning();
          linkedUser = updated ?? existing;

          await tx
            .update(sessions)
            .set({ revokedAt: now })
            .where(and(eq(sessions.userId, existing.id), isNull(sessions.revokedAt)));
        }
      });
      user = linkedUser;

      await writeAudit(db, {
        shopId: null,
        userId: existing.id,
        action: "auth.google_linked",
        entityType: "user",
        entityId: existing.id,
        ipHash: meta.ipHash,
      });
    } else {
      isNewUser = true;
      const shopName = `Boutique de ${profile.name}`;

      user = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            email: profile.email,
            name: profile.name,
            passwordHash: null,
            emailVerifiedAt: new Date(),
          })
          .returning();

        if (!created) throw new Error("Création de l'utilisateur impossible");

        await tx.insert(authIdentities).values({
          userId: created.id,
          provider: "google",
          providerAccountId: profile.sub,
        });

        const shop = await createDefaultShop(tx as unknown as Database, created, shopName);

        await writeAudit(tx as unknown as Database, {
          shopId: shop.id,
          userId: created.id,
          action: "shop.created",
          entityType: "shop",
          entityId: shop.id,
          metadata: { provider: "google", name: shop.name },
          ipHash: meta.ipHash,
        });

        return created;
      });
    }
  }

  if (!user) {
    throw new ApiError(401, "google_failed", "Connexion Google impossible.");
  }

  let membershipRows = await db
    .select({ shop: shops, role: memberships.role })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.shopId))
    .where(and(eq(memberships.userId, user.id), isNull(shops.archivedAt)))
    .orderBy(memberships.createdAt)
    .limit(1);

  if (!membershipRows[0]) {
    // Compte sans boutique (cas limite) : on en crée une.
    const shop = await db.transaction((tx) =>
      createDefaultShop(
        tx as unknown as Database,
        user,
        `Boutique de ${user.name}`,
      ),
    );
    membershipRows = [{ shop, role: "owner" }];
  }

  const first = membershipRows[0];
  if (!first) {
    throw new ApiError(403, "no_shop", "Aucune boutique active pour ce compte.");
  }

  // Répare les boutiques Google créées avant l'ajout de l'entrepôt par défaut.
  await ensureDefaultWarehouse(db, first.shop.id);

  const session = await createSession({
    userId: user.id,
    activeShopId: first.shop.id,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });

  await writeAudit(db, {
    shopId: first.shop.id,
    userId: user.id,
    action: isNewUser ? "auth.google_register" : "auth.google_login",
    entityType: "user",
    entityId: user.id,
    metadata: { provider: "google" },
    ipHash: meta.ipHash,
  });

  return {
    user,
    shop: first.shop,
    role: first.role,
    session,
    isNewUser,
  };
}

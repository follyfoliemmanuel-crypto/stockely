import { and, eq, isNull, sql } from "drizzle-orm";

import { getEnv } from "@/lib/env";
import { randomSuffix, slugify } from "@/lib/slug";
import { writeAudit } from "@/server/audit";
import { getDb, type Database } from "@/server/db";
import {
  memberships,
  saleCounters,
  shopSettings,
  shops,
  users,
  warehouses,
  type MemberRole,
  type Shop,
  type User,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import type { LoginInput, RegisterInput } from "@/server/validation/auth";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { assertLoginAllowed, recordLoginAttempt } from "@/server/auth/rate-limit";
import { createSession, type CreatedSession } from "@/server/auth/session";

export interface Authenticated {
  user: User;
  shop: Shop;
  role: MemberRole;
  session: CreatedSession;
}

interface RequestMeta {
  ipHash: string;
  userAgent: string | null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function uniqueSlug(base: string): Promise<string> {
  const db = getDb();
  const root = slugify(base) || "boutique";
  let candidate = root;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db
      .select({ id: shops.id })
      .from(shops)
      .where(eq(shops.slug, candidate))
      .limit(1);

    if (!existing[0]) return candidate;
    candidate = `${root}-${randomSuffix()}`;
  }

  return `${root}-${randomSuffix(8)}`;
}

/**
 * Inscription : crée l'utilisateur, sa boutique et son adhésion propriétaire
 * dans une seule transaction. Aucun compte orphelin n'est possible.
 */
export async function registerUser(
  input: RegisterInput,
  meta: RequestMeta,
): Promise<Authenticated> {
  const db = getDb();
  const env = getEnv();
  const passwordHash = await hashPassword(input.password);
  const slug = await uniqueSlug(input.shopName);

  try {
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          name: input.name,
          passwordHash,
        })
        .returning();

      if (!user) throw new Error("Création de l'utilisateur impossible");

      const [shop] = await tx
        .insert(shops)
        .values({
          name: input.shopName,
          slug,
          currency: input.currency ?? env.DEFAULT_CURRENCY,
          timezone: input.timezone ?? env.DEFAULT_TIMEZONE,
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
      await tx.insert(warehouses).values({
        shopId: shop.id,
        name: "Entrepôt principal",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });

      await writeAudit(tx as unknown as Database, {
        shopId: shop.id,
        userId: user.id,
        action: "shop.created",
        entityType: "shop",
        entityId: shop.id,
        metadata: { name: shop.name },
        ipHash: meta.ipHash,
      });

      return { user, shop };
    });

    const session = await createSession({
      userId: created.user.id,
      activeShopId: created.shop.id,
      ipHash: meta.ipHash,
      userAgent: meta.userAgent,
    });

    await writeAudit(db, {
      shopId: created.shop.id,
      userId: created.user.id,
      action: "auth.register",
      entityType: "user",
      entityId: created.user.id,
      ipHash: meta.ipHash,
    });

    return {
      user: created.user,
      shop: created.shop,
      role: "owner",
      session,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Message volontairement générique : il ne confirme pas qu'une adresse
      // e-mail précise est déjà enregistrée (anti-énumération de comptes).
      throw new ApiError(
        409,
        "registration_failed",
        "Impossible de créer le compte avec ces informations. Si vous avez déjà un compte, connectez-vous ou réinitialisez votre mot de passe.",
      );
    }
    throw error;
  }
}

/**
 * Connexion : limitation des tentatives, vérification Argon2id,
 * puis création d'une session. Le message d'erreur reste générique
 * pour ne pas révéler si l'e-mail existe.
 */
export async function loginUser(
  input: LoginInput,
  meta: RequestMeta,
): Promise<Authenticated> {
  const db = getDb();
  const email = input.email.toLowerCase();

  await assertLoginAllowed(email, meta.ipHash);

  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  const user = rows[0];
  const passwordOk = user?.passwordHash
    ? await verifyPassword(user.passwordHash, input.password)
    : // Coût comparable pour ne pas révéler l'existence ou le mode du compte.
      await hashPassword(input.password).then(() => false);

  if (!user || !passwordOk) {
    await recordLoginAttempt(email, meta.ipHash, false);
    throw new ApiError(
      401,
      "invalid_credentials",
      "Adresse e-mail ou mot de passe incorrect.",
    );
  }

  await recordLoginAttempt(email, meta.ipHash, true);

  const shopRows = await db
    .select({ shop: shops, role: memberships.role })
    .from(memberships)
    .innerJoin(shops, eq(shops.id, memberships.shopId))
    .where(and(eq(memberships.userId, user.id), isNull(shops.archivedAt)))
    .orderBy(memberships.createdAt)
    .limit(1);

  const first = shopRows[0];
  if (!first) {
    throw new ApiError(
      403,
      "no_shop",
      "Ce compte n'est rattaché à aucune boutique active.",
    );
  }

  const session = await createSession({
    userId: user.id,
    activeShopId: first.shop.id,
    ipHash: meta.ipHash,
    userAgent: meta.userAgent,
  });

  await writeAudit(db, {
    shopId: first.shop.id,
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    ipHash: meta.ipHash,
  });

  return {
    user,
    shop: first.shop,
    role: first.role,
    session,
  };
}

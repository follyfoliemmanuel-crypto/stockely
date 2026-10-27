/**
 * Crée le premier compte propriétaire d'une boutique.
 *
 * Usage (le mot de passe passe exclusivement par l'environnement,
 * jamais par un argument de ligne de commande) :
 *   OWNER_PASSWORD='...' npm run db:create-owner -- \
 *     --email owner@exemple.com --name "Awa Diallo" --shop "Maison Lumen"
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getEnv } from "../src/lib/env";
import { randomSuffix, slugify } from "../src/lib/slug";
import { writeAudit } from "../src/server/audit";
import { getDb, getPool, type Database } from "../src/server/db";
import {
  memberships,
  saleCounters,
  shopSettings,
  shops,
  users,
  warehouses,
} from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";

const ownerInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Adresse e-mail invalide."),
  name: z.string().trim().min(2, "Le nom est trop court.").max(120),
  shop: z.string().trim().min(2, "Le nom de la boutique est trop court.").max(120),
  password: z
    .string()
    .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
    .max(200, "Le mot de passe est trop long."),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Devise invalide (code ISO à 3 lettres)."),
});

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") return String(code);
  }
  return error instanceof Error ? error.name : "unknown";
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
      shop: { type: "string" },
      currency: { type: "string" },
    },
    allowPositionals: false,
    strict: true,
  });

  const parsed = ownerInputSchema.safeParse({
    email: values.email ?? "",
    name: values.name ?? "",
    shop: values.shop ?? "",
    password: process.env.OWNER_PASSWORD ?? "",
    currency: values.currency ?? getEnv().DEFAULT_CURRENCY,
  });

  if (!parsed.success) {
    // On n'affiche que les champs fautifs, jamais leur valeur.
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
    console.error(`Paramètres invalides : ${fields.join(", ")}.`);
    console.error(
      "Requis : --email, --name, --shop et la variable OWNER_PASSWORD (10 caractères minimum).",
    );
    process.exit(1);
  }

  const { email, name, shopName, password, currency } = {
    email: parsed.data.email,
    name: parsed.data.name,
    shopName: parsed.data.shop,
    password: parsed.data.password,
    currency: parsed.data.currency,
  };

  const db = getDb();
  const passwordHash = await hashPassword(password);
  const baseSlug = slugify(shopName) || "boutique";

  await db.transaction(async (tx) => {
    const existingUser = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    let user = existingUser[0];
    if (!user) {
      const inserted = await tx
        .insert(users)
        .values({ email, name, passwordHash })
        .returning();
      user = inserted[0];
    }

    if (!user) throw new Error("Création de l'utilisateur impossible");

    const existingShop = await tx
      .select()
      .from(shops)
      .where(eq(shops.slug, baseSlug))
      .limit(1);

    let shop = existingShop[0];
    if (!shop) {
      let slug = baseSlug;
      const collision = await tx
        .select({ id: shops.id })
        .from(shops)
        .where(eq(shops.slug, slug))
        .limit(1);
      if (collision[0]) slug = `${baseSlug}-${randomSuffix()}`;

      const inserted = await tx
        .insert(shops)
        .values({ name: shopName, slug, currency })
        .returning();
      shop = inserted[0];

      if (!shop) throw new Error("Création de la boutique impossible");

      await tx.insert(shopSettings).values({ shopId: shop.id });
      await tx.insert(saleCounters).values({ shopId: shop.id });
      await tx.insert(warehouses).values({
        shopId: shop.id,
        name: "Entrepôt principal",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      });
    }

    const existingMembership = await tx
      .select()
      .from(memberships)
      .where(sql`${memberships.shopId} = ${shop.id} and ${memberships.userId} = ${user.id}`)
      .limit(1);

    if (existingMembership[0]) {
      await tx
        .update(memberships)
        .set({ role: "owner", updatedAt: new Date() })
        .where(eq(memberships.id, existingMembership[0].id));
    } else {
      await tx.insert(memberships).values({
        shopId: shop.id,
        userId: user.id,
        role: "owner",
      });
    }

    await writeAudit(tx as unknown as Database, {
      shopId: shop.id,
      userId: user.id,
      action: "owner.created",
      entityType: "membership",
      entityId: user.id,
    });

    return { shop };
  });

  // Aucun e-mail, mot de passe ou jeton n'est affiché.
  console.log(
    "Compte propriétaire prêt.",
  );
}

main()
  .catch((error) => {
    console.error(`Échec de la création du propriétaire (code : ${errorCode(error)}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });

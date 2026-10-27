/**
 * Données de démonstration pour le développement uniquement.
 * Refuse de s'exécuter en production et ne modifie jamais une boutique existante.
 *
 * Usage :
 *   SEED_OWNER_PASSWORD='...' SEED_CASHIER_PASSWORD='...' npm run db:seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";

import { getEnv } from "../src/lib/env";
import { writeAudit } from "../src/server/audit";
import { hashPassword } from "../src/server/auth/password";
import { getDb, getPool, type Database } from "../src/server/db";
import {
  categories,
  customers,
  memberships,
  products,
  saleCounters,
  shopSettings,
  shops,
  stockMovements,
  suppliers,
  users,
  warehouseStock,
  warehouses,
} from "../src/server/db/schema";

const DEMO_SLUG = "maison-lumen-demo";

async function main() {
  const env = getEnv();
  if (env.NODE_ENV === "production") {
    console.error("Le seed est interdit en production.");
    process.exit(1);
  }

  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  const cashierPassword = process.env.SEED_CASHIER_PASSWORD;

  if (!ownerPassword || !cashierPassword || ownerPassword.length < 10 || cashierPassword.length < 10) {
    console.error(
      "SEED_OWNER_PASSWORD et SEED_CASHIER_PASSWORD sont requis (10 caractères minimum).",
    );
    process.exit(1);
  }

  const db = getDb();

  const existing = await db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.slug, DEMO_SLUG))
    .limit(1);

  if (existing[0]) {
    console.log("La boutique de démonstration existe déjà. Aucune donnée n'a été modifiée.");
    return;
  }

  const [ownerHash, cashierHash] = await Promise.all([
    hashPassword(ownerPassword),
    hashPassword(cashierPassword),
  ]);

  await db.transaction(async (tx) => {
    const [owner] = await tx
      .insert(users)
      .values({
        email: "owner@maison-lumen.example",
        name: "Awa Diallo",
        passwordHash: ownerHash,
      })
      .returning();

    const [cashier] = await tx
      .insert(users)
      .values({
        email: "caissier@maison-lumen.example",
        name: "Koffi Mensah",
        passwordHash: cashierHash,
      })
      .returning();

    if (!owner || !cashier) throw new Error("Création des utilisateurs impossible");

    const [shop] = await tx
      .insert(shops)
      .values({
        name: "Maison Lumen (démo)",
        slug: DEMO_SLUG,
        currency: env.DEFAULT_CURRENCY,
        timezone: env.DEFAULT_TIMEZONE,
        phone: "+228 90 00 00 00",
        address: "12 rue du Marché, Lomé",
      })
      .returning();

    if (!shop) throw new Error("Création de la boutique impossible");

    await tx.insert(shopSettings).values({
      shopId: shop.id,
      invoicePrefix: "ML",
      receiptFooter: "Merci de votre visite — Maison Lumen",
    });
    await tx.insert(saleCounters).values({ shopId: shop.id });
    const [mainWarehouse] = await tx
      .insert(warehouses)
      .values({
        shopId: shop.id,
        name: "Entrepôt principal",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      })
      .returning({ id: warehouses.id });

    await tx.insert(memberships).values([
      { shopId: shop.id, userId: owner.id, role: "owner" },
      { shopId: shop.id, userId: cashier.id, role: "cashier" },
    ]);

    const insertedCategories = await tx
      .insert(categories)
      .values([
        { shopId: shop.id, name: "Épicerie" },
        { shopId: shop.id, name: "Boissons" },
        { shopId: shop.id, name: "Hygiène" },
      ])
      .returning();

    const epicerie = insertedCategories.find((item) => item.name === "Épicerie");
    const boissons = insertedCategories.find((item) => item.name === "Boissons");
    const hygiene = insertedCategories.find((item) => item.name === "Hygiène");

    const insertedSuppliers = await tx
      .insert(suppliers)
      .values([
        {
          shopId: shop.id,
          name: "Grossiste Sahel",
          phone: "+228 91 11 11 11",
          email: "contact@grossiste-sahel.example",
        },
        {
          shopId: shop.id,
          name: "Distri Ouest",
          phone: "+228 92 22 22 22",
        },
      ])
      .returning();

    const supplier = insertedSuppliers[0];

    const insertedProducts = await tx.insert(products).values([
      {
        shopId: shop.id,
        categoryId: epicerie?.id,
        supplierId: supplier?.id,
        name: "Riz parfumé 5 kg",
        sku: "RIZ-005",
        barcode: "6001000000011",
        costCents: 320_000,
        priceCents: 425_000,
        quantity: 24,
        minStock: 10,
      },
      {
        shopId: shop.id,
        categoryId: epicerie?.id,
        supplierId: supplier?.id,
        name: "Huile végétale 1 L",
        sku: "HUI-001",
        barcode: "6001000000028",
        costCents: 95_000,
        priceCents: 125_000,
        quantity: 3,
        minStock: 8,
      },
      {
        shopId: shop.id,
        categoryId: boissons?.id,
        name: "Eau minérale 1,5 L",
        sku: "EAU-015",
        costCents: 25_000,
        priceCents: 40_000,
        quantity: 48,
        minStock: 12,
      },
      {
        shopId: shop.id,
        categoryId: boissons?.id,
        name: "Jus d'orange 1 L",
        sku: "JUS-001",
        costCents: 70_000,
        priceCents: 100_000,
        quantity: 0,
        minStock: 6,
      },
      {
        shopId: shop.id,
        categoryId: hygiene?.id,
        name: "Savon de coco",
        sku: "SAV-001",
        costCents: 15_000,
        priceCents: 25_000,
        quantity: 60,
        minStock: 20,
      },
      {
        shopId: shop.id,
        categoryId: hygiene?.id,
        name: "Dentifrice menthe",
        sku: "DEN-001",
        costCents: 45_000,
        priceCents: 70_000,
        quantity: 18,
        minStock: 10,
      },
    ]).returning({ id: products.id, quantity: products.quantity });

    if (!mainWarehouse) throw new Error("Entrepôt principal non créé");
    await tx.insert(warehouseStock).values(
      insertedProducts.map((product) => ({
        shopId: shop.id,
        warehouseId: mainWarehouse.id,
        productId: product.id,
        quantity: product.quantity,
      })),
    );

    await tx.insert(stockMovements).values(
      insertedProducts
        .filter((product) => product.quantity > 0)
        .map((product) => ({
          shopId: shop.id,
          productId: product.id,
          warehouseId: mainWarehouse.id,
          userId: owner.id,
          type: "in" as const,
          quantityDelta: product.quantity,
          reason: "Stock initial",
        })),
    );

    await tx.insert(customers).values([
      {
        shopId: shop.id,
        name: "Client de démonstration",
        phone: "+228 99 00 00 00",
        notes: "Donnée créée par le seed de développement.",
      },
    ]);

    await writeAudit(tx as unknown as Database, {
      shopId: shop.id,
      userId: owner.id,
      action: "demo.seeded",
      entityType: "shop",
      entityId: shop.id,
    });
  });

  console.log("Données de démonstration créées.");
  console.log("Comptes de démonstration prêts (identifiants définis dans le seed).");
  console.log("Mots de passe : définis via SEED_*_PASSWORD (non affichés).");
}

main()
  .catch(() => {
    console.error("Échec du seed de démonstration.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });

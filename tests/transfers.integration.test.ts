import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { AuthContext } from "@/server/auth/context";
import { getDb, getPool } from "@/server/db";
import {
  memberships,
  products,
  saleCounters,
  shopSettings,
  shops,
  stockMovements,
  transferCounters,
  users,
  warehouseStock,
  warehouses,
  type MemberRole,
  type Session,
} from "@/server/db/schema";
import { effectivePermissions } from "@/server/permissions";
import {
  cancelTransfer,
  createTransfer,
  getTransfer,
  receiveTransfer,
  shipTransfer,
} from "@/server/services/transfers";
import { recordStockMovement } from "@/server/services/stock";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

interface Fixture {
  context: AuthContext;
  userId: string;
  shopId: string;
  warehouse1Id: string;
  warehouse2Id: string;
}

describe.skipIf(!hasTestDatabase)("transferts inter-entrepôts (intégration)", () => {
  const db = getDb();

  afterAll(async () => {
    await getPool().end();
  });

  async function createTransferFixture(label: string, role: MemberRole = "owner"): Promise<Fixture> {
    const suffix = `${Date.now()}-${randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        email: `it-trf-${label}-${suffix}@example.test`,
        name: `Test Transfer ${label}`,
      })
      .returning();
    if (!user) throw new Error("Utilisateur de test non créé");

    const [shop] = await db
      .insert(shops)
      .values({
        name: `Boutique TRF ${label} ${suffix.slice(0, 8)}`,
        slug: `it-trf-${label}-${suffix}`,
        currency: "XOF",
        timezone: "Africa/Lome",
      })
      .returning();
    if (!shop) throw new Error("Boutique de test non créée");

    const [membership] = await db
      .insert(memberships)
      .values({ shopId: shop.id, userId: user.id, role })
      .returning();
    if (!membership) throw new Error("Adhésion de test non créée");

    await db.insert(shopSettings).values({ shopId: shop.id, invoicePrefix: "TRF" });
    await db.insert(saleCounters).values({ shopId: shop.id, lastNumber: 0 });
    await db.insert(transferCounters).values({ shopId: shop.id, lastNumber: 0 });

    const [w1] = await db
      .insert(warehouses)
      .values({
        shopId: shop.id,
        name: "Entrepôt Central",
        code: "CENTRAL",
        isDefault: true,
        isActive: true,
      })
      .returning();

    const [w2] = await db
      .insert(warehouses)
      .values({
        shopId: shop.id,
        name: "Boutique Sud",
        code: "SUD",
        isDefault: false,
        isActive: true,
      })
      .returning();

    if (!w1 || !w2) throw new Error("Entrepôts de test non créés");

    return {
      userId: user.id,
      shopId: shop.id,
      warehouse1Id: w1.id,
      warehouse2Id: w2.id,
      context: {
        user,
        shop,
        membership,
        role,
        permissions: effectivePermissions(role, membership.permissionOverrides),
        session: {} as Session,
        csrfToken: "test-csrf",
      },
    };
  }

  async function createProductWithStock(
    context: AuthContext,
    warehouseId: string,
    sku: string,
    quantity: number,
  ) {
    const [prod] = await db
      .insert(products)
      .values({
        shopId: context.shop.id,
        name: `Produit ${sku}`,
        sku,
        priceCents: 1000,
        costCents: 500,
        quantity: 0,
      })
      .returning();
    if (!prod) throw new Error("Produit de test non créé");

    await recordStockMovement(
      context,
      {
        productId: prod.id,
        type: "in",
        quantity,
        reason: "Stock initial",
      },
      warehouseId,
    );

    return prod;
  }

  it("exécute le cycle complet : préparation, expédition et réception intégrale", async () => {
    const fix = await createTransferFixture("cycle");
    const prod = await createProductWithStock(fix.context, fix.warehouse1Id, "CYCLE-1", 100);

    // 1. Création / Préparation du transfert de 30 unités de w1 vers w2
    const { transferId, number } = await createTransfer(fix.context, {
      fromWarehouseId: fix.warehouse1Id,
      toWarehouseId: fix.warehouse2Id,
      items: [{ productId: prod.id, quantity: 30 }],
      note: "Réapprovisionnement Boutique Sud",
    });

    expect(number).toMatch(/^TRF-\d{5}$/);

    // Vérifier stock w1 (doit être 100 - 30 = 70)
    const stockW1Prep = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse1Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW1Prep[0]?.quantity).toBe(70);

    // Vérifier stock total boutique (doit toujours être 100 car les 30 sont en cours de transfert)
    const totalProdPrep = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, prod.id));
    expect(totalProdPrep[0]?.quantity).toBe(100);

    // 2. Expédition
    await shipTransfer(fix.context, transferId, { note: "Camion parti à 14h" });
    const transferShipped = await getTransfer(fix.shopId, transferId);
    expect(transferShipped?.status).toBe("shipped");
    expect(transferShipped?.shippedAt).not.toBeNull();

    // 3. Réception intégrale
    await receiveTransfer(fix.context, transferId, {
      items: [{ productId: prod.id, quantityReceived: 30, discrepancyReason: null }],
      note: "Réceptionné sans incident",
    });

    const transferReceived = await getTransfer(fix.shopId, transferId);
    expect(transferReceived?.status).toBe("received");
    expect(transferReceived?.receivedAt).not.toBeNull();

    // Vérifier stock w2 (doit avoir reçu les 30 unités)
    const stockW2Rec = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse2Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW2Rec[0]?.quantity).toBe(30);

    // Vérifier stock total boutique (toujours 100 au total : 70 en w1 + 30 en w2)
    const totalProdRec = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, prod.id));
    expect(totalProdRec[0]?.quantity).toBe(100);
  });

  it("gère les écarts et pertes à la réception en ajustant le total de l'entreprise", async () => {
    const fix = await createTransferFixture("discrepancy");
    const prod = await createProductWithStock(fix.context, fix.warehouse1Id, "DISC-1", 50);

    // Transférer 20 unités
    const { transferId } = await createTransfer(fix.context, {
      fromWarehouseId: fix.warehouse1Id,
      toWarehouseId: fix.warehouse2Id,
      items: [{ productId: prod.id, quantity: 20 }],
      note: null,
    });

    // Réceptionner seulement 18 unités (2 unités cassées/perdues)
    await receiveTransfer(fix.context, transferId, {
      items: [
        {
          productId: prod.id,
          quantityReceived: 18,
          discrepancyReason: "2 bouteilles brisées dans le carton",
        },
      ],
      note: null,
    });

    // Stock w1 = 30
    const stockW1 = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse1Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW1[0]?.quantity).toBe(30);

    // Stock w2 = 18
    const stockW2 = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse2Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW2[0]?.quantity).toBe(18);

    // Total de l'entreprise : 50 initial - 2 perdus = 48
    const totalProd = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, prod.id));
    expect(totalProd[0]?.quantity).toBe(48);

    // Vérifier qu'un mouvement d'ajustement compensatoire a été tracé
    const movements = await db
      .select()
      .from(stockMovements)
      .where(
        sql`${stockMovements.transferId} = ${transferId} and ${stockMovements.type} = 'adjustment'`,
      );
    expect(movements.length).toBe(1);
    expect(movements[0]?.quantityDelta).toBe(-2);
  });

  it("annule un transfert et réintègre le stock dans l'entrepôt d'origine", async () => {
    const fix = await createTransferFixture("cancel");
    const prod = await createProductWithStock(fix.context, fix.warehouse1Id, "CANC-1", 40);

    const { transferId } = await createTransfer(fix.context, {
      fromWarehouseId: fix.warehouse1Id,
      toWarehouseId: fix.warehouse2Id,
      items: [{ productId: prod.id, quantity: 15 }],
      note: null,
    });

    // Annuler le transfert
    await cancelTransfer(fix.context, transferId, {
      reason: "Commande annulée par le responsable de boutique",
    });

    const transfer = await getTransfer(fix.shopId, transferId);
    expect(transfer?.status).toBe("cancelled");
    expect(transfer?.cancelReason).toContain("Commande annulée");

    // Stock w1 réintégré à 40
    const stockW1 = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse1Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW1[0]?.quantity).toBe(40);

    // Tentative de re-réceptionner un transfert annulé -> refus
    await expect(
      receiveTransfer(fix.context, transferId, {
        items: [{ productId: prod.id, quantityReceived: 15, discrepancyReason: null }],
        note: null,
      }),
    ).rejects.toThrow();
  });

  it("refuse un transfert lorsque le stock source est insuffisant", async () => {
    const fix = await createTransferFixture("insufficient");
    const prod = await createProductWithStock(fix.context, fix.warehouse1Id, "INSUF-1", 10);

    await expect(
      createTransfer(fix.context, {
        fromWarehouseId: fix.warehouse1Id,
        toWarehouseId: fix.warehouse2Id,
        items: [{ productId: prod.id, quantity: 15 }], // 15 > 10 disponible
        note: null,
      }),
    ).rejects.toThrow();
  });

  it("garantit l'idempotence : une même clé ne crée pas de double transfert", async () => {
    const fix = await createTransferFixture("idempotent");
    const prod = await createProductWithStock(fix.context, fix.warehouse1Id, "IDEM-1", 100);
    const key = `idempotency-key-${randomUUID()}`;

    const res1 = await createTransfer(fix.context, {
      fromWarehouseId: fix.warehouse1Id,
      toWarehouseId: fix.warehouse2Id,
      items: [{ productId: prod.id, quantity: 20 }],
      note: null,
      idempotencyKey: key,
    });

    // Deuxième appel avec la même clé
    const res2 = await createTransfer(fix.context, {
      fromWarehouseId: fix.warehouse1Id,
      toWarehouseId: fix.warehouse2Id,
      items: [{ productId: prod.id, quantity: 20 }],
      note: null,
      idempotencyKey: key,
    });

    expect(res1.transferId).toBe(res2.transferId);
    expect(res1.number).toBe(res2.number);

    // Vérifier que le stock n'a été décrémenté qu'une seule fois (100 - 20 = 80, pas 60)
    const stockW1 = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        sql`${warehouseStock.warehouseId} = ${fix.warehouse1Id} and ${warehouseStock.productId} = ${prod.id}`,
      );
    expect(stockW1[0]?.quantity).toBe(80);
  });

  it("isole strictement les entreprises : refuse un transfert vers l'entrepôt d'une autre entreprise", async () => {
    const fixA = await createTransferFixture("shopA");
    const fixB = await createTransferFixture("shopB");

    const prodA = await createProductWithStock(fixA.context, fixA.warehouse1Id, "ISOL-A", 50);

    // Tenter de transférer vers l'entrepôt de l'entreprise B
    await expect(
      createTransfer(fixA.context, {
        fromWarehouseId: fixA.warehouse1Id,
        toWarehouseId: fixB.warehouse1Id, // Entrepôt de la boutique B
        items: [{ productId: prodA.id, quantity: 10 }],
        note: null,
      }),
    ).rejects.toThrow();
  });
});

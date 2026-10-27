import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { AuthContext } from "@/server/auth/context";
import { getDb, getPool } from "@/server/db";
import {
  auditLogs,
  memberships,
  payments,
  products,
  saleCounters,
  sales,
  shopSettings,
  shops,
  stockMovements,
  users,
  warehouseAccess,
  warehouseStock,
  warehouses,
  type MemberRole,
  type Session,
} from "@/server/db/schema";
import { effectivePermissions } from "@/server/permissions";
import { createSale, cancelSale } from "@/server/services/sales";
import { recordStockMovement } from "@/server/services/stock";
import { getProduct, updateProduct } from "@/server/services/products";
import {
  getWarehouse,
  listAccessibleWarehouses,
  listWarehouses,
  resolveWarehouse,
  setWarehouseArchived,
} from "@/server/services/warehouses";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

interface Fixture {
  context: AuthContext;
  userId: string;
  shopId: string;
  warehouseId: string;
}

/**
 * Tests d'intégration exécutés uniquement sur TEST_DATABASE_URL.
 * Chaque test crée ses propres boutiques, entrepôts et produits ; aucune
 * donnée de développement n'est lue ni modifiée.
 */
describe.skipIf(!hasTestDatabase)("catalogue, stock et ventes (intégration)", () => {
  const db = getDb();

  afterAll(async () => {
    await getPool().end();
  });

  async function createFixture(label: string, role: MemberRole): Promise<Fixture> {
    const suffix = `${Date.now()}-${randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        email: `it-${label}-${suffix}@example.test`,
        name: `Test ${label}`,
      })
      .returning();
    if (!user) throw new Error("Utilisateur de test non créé");

    const [shop] = await db
      .insert(shops)
      .values({
        name: `Boutique ${label} ${suffix.slice(0, 8)}`,
        slug: `it-${label}-${suffix}`,
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

    await db.insert(shopSettings).values({ shopId: shop.id, invoicePrefix: "TST" });
    await db.insert(saleCounters).values({ shopId: shop.id, lastNumber: 0 });

    const [warehouse] = await db
      .insert(warehouses)
      .values({
        shopId: shop.id,
        name: "Entrepôt principal",
        code: "MAIN",
        isDefault: true,
        isActive: true,
      })
      .returning();
    if (!warehouse) throw new Error("Entrepôt de test non créé");

    return {
      userId: user.id,
      shopId: shop.id,
      warehouseId: warehouse.id,
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

  async function addWarehouse(shopId: string, code: string) {
    const [warehouse] = await db
      .insert(warehouses)
      .values({
        shopId,
        name: `Entrepôt ${code}`,
        code,
        isDefault: false,
        isActive: true,
      })
      .returning();
    if (!warehouse) throw new Error("Entrepôt secondaire non créé");
    return warehouse;
  }

  async function createProduct(
    shopId: string,
    warehouseId: string,
    overrides: Partial<typeof products.$inferInsert> = {},
  ) {
    const [product] = await db
      .insert(products)
      .values({
        shopId,
        name: "Produit de test",
        sku: `SKU-${randomUUID().slice(0, 12)}`,
        priceCents: 1_000,
        costCents: 600,
        quantity: 5,
        minStock: 1,
        ...overrides,
      })
      .returning();
    if (!product) throw new Error("Produit de test non créé");

    await db.insert(warehouseStock).values({
      shopId,
      warehouseId,
      productId: product.id,
      quantity: product.quantity,
    });

    return product;
  }

  /**
   * Ajoute du stock dans un entrepôt secondaire en maintenant l'invariant
   * products.quantity = somme(warehouse_stock.quantity).
   */
  async function setWarehouseQuantity(
    shopId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
  ) {
    const [current] = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.warehouseId, warehouseId),
          eq(warehouseStock.productId, productId),
        ),
      );
    const delta = quantity - (current?.quantity ?? 0);

    await db
      .insert(warehouseStock)
      .values({ shopId, warehouseId, productId, quantity })
      .onConflictDoUpdate({
        target: [warehouseStock.warehouseId, warehouseStock.productId],
        set: { quantity, updatedAt: new Date() },
      });

    if (delta !== 0) {
      await db
        .update(products)
        .set({ quantity: sql`${products.quantity} + ${delta}` })
        .where(eq(products.id, productId));
    }
  }

  async function warehouseQuantity(warehouseId: string, productId: string) {
    const [row] = await db
      .select({ quantity: warehouseStock.quantity })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.warehouseId, warehouseId),
          eq(warehouseStock.productId, productId),
        ),
      );
    return row?.quantity ?? null;
  }

  it("isole strictement les produits, le stock et les ventes entre boutiques", async () => {
    const shopA = await createFixture("tenant-a", "owner");
    const shopB = await createFixture("tenant-b", "owner");
    const productA = await createProduct(shopA.shopId, shopA.warehouseId, {
      quantity: 10,
    });

    expect(await getProduct(shopA.shopId, productA.id)).not.toBeNull();
    expect(await getProduct(shopB.shopId, productA.id)).toBeNull();

    await expect(
      updateProduct(shopB.context, productA.id, {
        name: "Tentative",
        sku: productA.sku,
        barcode: null,
        description: null,
        categoryId: null,
        supplierId: null,
        costCents: 600,
        priceCents: 1_000,
        minStock: 1,
      }),
    ).rejects.toMatchObject({ status: 404, code: "product_not_found" });

    await expect(
      recordStockMovement(shopB.context, {
        productId: productA.id,
        type: "out",
        quantity: 1,
        unitCostCents: null,
        reason: "test",
      }),
    ).rejects.toMatchObject({ status: 404, code: "product_not_found" });

    await expect(
      createSale(shopB.context, {
        items: [{ productId: productA.id, quantity: 1 }],
        customerId: null,
        discountCents: 0,
        paymentMethod: "cash",
        reference: null,
        note: null,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 422, code: "invalid_product" });

    const [unchanged] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, productA.id));
    expect(unchanged?.quantity).toBe(10);
  });

  it("refuse un entrepôt appartenant à une autre boutique", async () => {
    const shopA = await createFixture("warehouse-a", "owner");
    const shopB = await createFixture("warehouse-b", "owner");

    await expect(
      resolveWarehouse(shopB.context, shopA.warehouseId),
    ).rejects.toMatchObject({ status: 404, code: "warehouse_not_found" });

    await expect(
      recordStockMovement(
        shopB.context,
        {
          productId: randomUUID(),
          type: "in",
          quantity: 1,
          unitCostCents: null,
          reason: "tentative",
        },
        shopA.warehouseId,
      ),
    ).rejects.toMatchObject({ status: 404, code: "warehouse_not_found" });
  });

  it("sérialise les sorties concurrentes et refuse le stock négatif", async () => {
    const fixture = await createFixture("stock", "owner");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 10,
    });

    const results = await Promise.allSettled([
      recordStockMovement(fixture.context, {
        productId: product.id,
        type: "out",
        quantity: 7,
        unitCostCents: null,
        reason: "sortie concurrente 1",
      }),
      recordStockMovement(fixture.context, {
        productId: product.id,
        type: "out",
        quantity: 7,
        unitCostCents: null,
        reason: "sortie concurrente 2",
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      status: "rejected",
      reason: { status: 422, code: "insufficient_stock" },
    });

    const [updated] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, product.id));
    expect(updated?.quantity).toBe(3);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(3);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, product.id),
          eq(stockMovements.type, "out"),
        ),
      );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantityDelta).toBe(-7);
    expect(movements[0]?.warehouseId).toBe(fixture.warehouseId);
  });

  it("ventile le stock par entrepôt sans toucher aux autres entrepôts", async () => {
    const fixture = await createFixture("multi-warehouse", "owner");
    const secondary = await addWarehouse(fixture.shopId, "SECOND");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 10,
      priceCents: 1_000,
      costCents: 600,
    });
    await setWarehouseQuantity(
      fixture.shopId,
      secondary.id,
      product.id,
      4,
    );

    const sale = await createSale(
      fixture.context,
      {
        items: [{ productId: product.id, quantity: 3 }],
        customerId: null,
        discountCents: 0,
        paymentMethod: "cash",
        reference: null,
        note: null,
        idempotencyKey: randomUUID(),
      },
      fixture.warehouseId,
    );

    expect(sale.totalCents).toBe(3_000);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(7);
    expect(await warehouseQuantity(secondary.id, product.id)).toBe(4);

    const [productRow] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, product.id));
    expect(productRow?.quantity).toBe(11);

    const [saleRow] = await db
      .select({ warehouseId: sales.warehouseId })
      .from(sales)
      .where(eq(sales.id, sale.id));
    expect(saleRow?.warehouseId).toBe(fixture.warehouseId);

    const [movement] = await db
      .select({ warehouseId: stockMovements.warehouseId })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.saleId, sale.id),
          eq(stockMovements.type, "sale"),
        ),
      );
    expect(movement?.warehouseId).toBe(fixture.warehouseId);
  });

  it("refuse une vente si l'entrepôt choisi manque de stock", async () => {
    const fixture = await createFixture("warehouse-stock", "owner");
    const secondary = await addWarehouse(fixture.shopId, "SECOND");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 10,
    });
    await setWarehouseQuantity(fixture.shopId, secondary.id, product.id, 1);

    await expect(
      createSale(
        fixture.context,
        {
          items: [{ productId: product.id, quantity: 2 }],
          customerId: null,
          discountCents: 0,
          paymentMethod: "cash",
          reference: null,
          note: null,
          idempotencyKey: randomUUID(),
        },
        secondary.id,
      ),
    ).rejects.toMatchObject({ status: 422, code: "insufficient_stock" });

    expect(await warehouseQuantity(secondary.id, product.id)).toBe(1);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(10);

    const [productRow] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, product.id));
    expect(productRow?.quantity).toBe(11);
  });

  it("limite les entrepôts accessibles selon les autorisations du membre", async () => {
    const fixture = await createFixture("warehouse-access", "cashier");
    const secondary = await addWarehouse(fixture.shopId, "SECOND");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 3,
    });
    await setWarehouseQuantity(fixture.shopId, secondary.id, product.id, 8);

    // Sans attribution, un caissier ne voit que l'entrepôt par défaut.
    const before = await listAccessibleWarehouses(fixture.context);
    expect(before.map((warehouse) => warehouse.id)).toEqual([fixture.warehouseId]);

    await db.insert(warehouseAccess).values({
      shopId: fixture.shopId,
      warehouseId: secondary.id,
      membershipId: fixture.context.membership.id,
    });

    const after = await listAccessibleWarehouses(fixture.context);
    expect(after.map((warehouse) => warehouse.id)).toEqual([secondary.id]);

    const resolved = await resolveWarehouse(fixture.context);
    expect(resolved.id).toBe(secondary.id);

    await expect(
      resolveWarehouse(fixture.context, fixture.warehouseId),
    ).rejects.toMatchObject({ status: 404, code: "warehouse_not_found" });
  });

  it("protège l'archivage et transfère le statut par défaut", async () => {
    const fixture = await createFixture("warehouse-archive", "owner");
    const secondary = await addWarehouse(fixture.shopId, "SECOND");

    // Un entrepôt qui contient du stock ne peut pas être archivé.
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 2,
    });
    await expect(
      setWarehouseArchived(fixture.context, fixture.warehouseId, true),
    ).rejects.toMatchObject({ status: 409, code: "warehouse_not_empty" });

    // On vide l'entrepôt par une sortie, puis on l'archive.
    await recordStockMovement(fixture.context, {
      productId: product.id,
      type: "out",
      quantity: 2,
      unitCostCents: null,
      reason: "vidage avant archivage",
    });

    await setWarehouseArchived(fixture.context, fixture.warehouseId, true);

    expect(await getWarehouse(fixture.shopId, fixture.warehouseId)).toBeNull();
    const remaining = await listWarehouses(fixture.shopId);
    expect(remaining.map((warehouse) => warehouse.id)).toEqual([secondary.id]);
    expect(remaining[0]?.isDefault).toBe(true);

    // Le dernier entrepôt actif ne peut pas être archivé.
    await expect(
      setWarehouseArchived(fixture.context, secondary.id, true),
    ).rejects.toMatchObject({ status: 409, code: "last_warehouse" });
  });

  it("est idempotente sur les mouvements de stock", async () => {
    const fixture = await createFixture("stock-idempotence", "owner");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 10,
    });
    const key = randomUUID();

    const input = {
      productId: product.id,
      type: "out" as const,
      quantity: 2,
      unitCostCents: null,
      reason: "sortie idempotente",
      idempotencyKey: key,
    };

    const [first, second] = await Promise.all([
      recordStockMovement(fixture.context, input),
      recordStockMovement(fixture.context, input),
    ]);

    expect(first.movementId).toBe(second.movementId);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(8);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.shopId, fixture.shopId),
          eq(stockMovements.idempotencyKey, key),
        ),
      );
    expect(movements).toHaveLength(1);
  });

  it("est idempotente sous concurrence : une clé produit une seule vente", async () => {
    const fixture = await createFixture("idempotence", "owner");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 5,
      priceCents: 1_000,
      costCents: 600,
    });

    const key = randomUUID();
    const input = {
      items: [{ productId: product.id, quantity: 2 }],
      customerId: null,
      discountCents: 0,
      paymentMethod: "cash" as const,
      reference: null,
      note: null,
      idempotencyKey: key,
    };

    const [first, second] = await Promise.all([
      createSale(fixture.context, input),
      createSale(fixture.context, input),
    ]);

    expect(first.id).toBe(second.id);
    expect(first.number).toBe(second.number);
    expect(first.totalCents).toBe(2_000);

    const saleRows = await db
      .select()
      .from(sales)
      .where(and(eq(sales.shopId, fixture.shopId), eq(sales.idempotencyKey, key)));
    expect(saleRows).toHaveLength(1);

    const [updated] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, product.id));
    expect(updated?.quantity).toBe(3);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(3);
  });

  it("annule une vente, réintègre le stock et rembourse le paiement", async () => {
    const fixture = await createFixture("annulation", "owner");
    const product = await createProduct(fixture.shopId, fixture.warehouseId, {
      quantity: 5,
      priceCents: 1_000,
      costCents: 600,
    });

    const sale = await createSale(fixture.context, {
      items: [{ productId: product.id, quantity: 2 }],
      customerId: null,
      discountCents: 0,
      paymentMethod: "mobile_money",
      reference: "TX-123",
      note: "test annulation",
      idempotencyKey: randomUUID(),
    });

    await cancelSale(fixture.context, sale.id, "Retour client");

    const [afterSale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, sale.id));
    expect(afterSale?.status).toBe("cancelled");
    expect(afterSale?.cancelReason).toBe("Retour client");

    const [afterProduct] = await db
      .select({ quantity: products.quantity })
      .from(products)
      .where(eq(products.id, product.id));
    expect(afterProduct?.quantity).toBe(5);
    expect(await warehouseQuantity(fixture.warehouseId, product.id)).toBe(5);

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.saleId, sale.id));
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.status).toBe("refunded");

    const reversal = await db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.saleId, sale.id),
          eq(stockMovements.type, "reversal"),
        ),
      );
    expect(reversal).toHaveLength(1);
    expect(reversal[0]?.quantityDelta).toBe(2);
    expect(reversal[0]?.reversalOfId).not.toBeNull();
    expect(reversal[0]?.warehouseId).toBe(fixture.warehouseId);

    const auditActions = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.entityId, sale.id));
    expect(auditActions.map((row) => row.action)).toEqual(
      expect.arrayContaining(["sale.created", "sale.cancelled"]),
    );

    await expect(
      cancelSale(fixture.context, sale.id, "Deuxième annulation"),
    ).rejects.toMatchObject({ status: 409, code: "sale_already_cancelled" });
  });

  it("refuse une remise au caissier mais l'autorise au propriétaire", async () => {
    const cashier = await createFixture("cashier", "cashier");
    const product = await createProduct(cashier.shopId, cashier.warehouseId, {
      quantity: 3,
      priceCents: 1_000,
    });

    await expect(
      createSale(cashier.context, {
        items: [{ productId: product.id, quantity: 1 }],
        customerId: null,
        discountCents: 100,
        paymentMethod: "cash",
        reference: null,
        note: null,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 403, code: "discount_forbidden" });

    const owner = await createFixture("discount", "owner");
    const ownerProduct = await createProduct(owner.shopId, owner.warehouseId, {
      quantity: 3,
      priceCents: 1_000,
    });
    const discounted = await createSale(owner.context, {
      items: [{ productId: ownerProduct.id, quantity: 1 }],
      customerId: null,
      discountCents: 100,
      paymentMethod: "cash",
      reference: null,
      note: null,
      idempotencyKey: randomUUID(),
    });
    expect(discounted.totalCents).toBe(900);
  });
});

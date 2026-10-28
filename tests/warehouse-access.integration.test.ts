import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import type { AuthContext } from "@/server/auth/context";
import { getDb, closePool } from "@/server/db";
import {
  memberships,
  products,
  saleCounters,
  shopSettings,
  shops,
  stockMovements,
  users,
  warehouseStock,
  warehouseTransfers,
  warehouses,
  type Session,
} from "@/server/db/schema";
import { effectivePermissions } from "@/server/permissions";
import { getProductDetail } from "@/server/services/products";
import { listStockMovements } from "@/server/services/stock";
import {
  listAccessibleWarehouses,
  listWarehouseMembers,
  listWarehouseOverview,
} from "@/server/services/warehouses";
import { getTransfer, listTransfers } from "@/server/services/transfers";

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

interface Fixture {
  context: AuthContext;
  shopId: string;
  mainWarehouseId: string;
  secondaryWarehouseId: string;
  thirdWarehouseId: string;
  productId: string;
}

/**
 * Vérifie qu'un rôle restreint (caissier sans attribution explicite) ne voit
 * que l'entrepôt par défaut et jamais les données des autres entrepôts.
 */
describe.skipIf(!hasTestDatabase)("isolation des entrepôts pour les rôles restreints", () => {
  const db = getDb();

  afterAll(async () => {
    await closePool();
  });

  async function createFixture(): Promise<Fixture> {
    const suffix = `${Date.now()}-${randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        email: `wh-access-${suffix}@example.test`,
        name: "Caissier Test",
      })
      .returning();
    if (!user) throw new Error("Utilisateur non créé");

    const [shop] = await db
      .insert(shops)
      .values({
        name: `Boutique Accès ${suffix}`,
        slug: `wh-access-${suffix}`,
        currency: "XOF",
        timezone: "Africa/Lome",
      })
      .returning();
    if (!shop) throw new Error("Boutique non créée");

    const [membership] = await db
      .insert(memberships)
      .values({ shopId: shop.id, userId: user.id, role: "cashier" })
      .returning();
    if (!membership) throw new Error("Adhésion non créée");

    await db.insert(shopSettings).values({ shopId: shop.id, invoicePrefix: "ACC" });
    await db.insert(saleCounters).values({ shopId: shop.id, lastNumber: 0 });

    const created = await db
      .insert(warehouses)
      .values([
        {
          shopId: shop.id,
          name: "Principal",
          code: "MAIN",
          isDefault: true,
          isActive: true,
        },
        {
          shopId: shop.id,
          name: "Réserve",
          code: "SECOND",
          isDefault: false,
          isActive: true,
        },
        {
          shopId: shop.id,
          name: "Hors périmètre",
          code: "THIRD",
          isDefault: false,
          isActive: true,
        },
      ])
      .returning();

    const main = created.find((row) => row.code === "MAIN");
    const secondary = created.find((row) => row.code === "SECOND");
    const third = created.find((row) => row.code === "THIRD");
    if (!main || !secondary || !third) throw new Error("Entrepôts non créés");

    const [product] = await db
      .insert(products)
      .values({
        shopId: shop.id,
        name: "Article confidentiel",
        sku: `CONF-${suffix}`,
        priceCents: 5_000,
        quantity: 30,
      })
      .returning();
    if (!product) throw new Error("Produit non créé");

    await db.insert(warehouseStock).values([
      { shopId: shop.id, warehouseId: main.id, productId: product.id, quantity: 10 },
      { shopId: shop.id, warehouseId: secondary.id, productId: product.id, quantity: 20 },
    ]);

    await db.insert(stockMovements).values([
      {
        shopId: shop.id,
        productId: product.id,
        warehouseId: main.id,
        userId: user.id,
        type: "in",
        quantityDelta: 10,
        reason: "Stock initial principal",
      },
      {
        shopId: shop.id,
        productId: product.id,
        warehouseId: secondary.id,
        userId: user.id,
        type: "in",
        quantityDelta: 20,
        reason: "Stock initial réserve",
      },
    ]);

    return {
      shopId: shop.id,
      mainWarehouseId: main.id,
      secondaryWarehouseId: secondary.id,
      thirdWarehouseId: third.id,
      productId: product.id,
      context: {
        user,
        shop,
        membership,
        role: "cashier",
        permissions: effectivePermissions("cashier", membership.permissionOverrides),
        session: {} as Session,
        csrfToken: "test-csrf",
      },
    };
  }

  it("ne liste que l'entrepôt par défaut pour un caissier sans attribution", async () => {
    const fixture = await createFixture();
    const accessible = await listAccessibleWarehouses(fixture.context);

    expect(accessible.map((row) => row.id)).toEqual([fixture.mainWarehouseId]);

    const overview = await listWarehouseOverview(fixture.context);
    expect(overview.map((row) => row.id)).toEqual([fixture.mainWarehouseId]);
    expect(overview[0]?.quantity).toBe(10);
  });

  it("filtre le stock par entrepôt et les mouvements dans la fiche produit", async () => {
    const fixture = await createFixture();
    const detail = await getProductDetail(fixture.context, fixture.productId);

    expect(detail).not.toBeNull();
    expect(detail!.stockByWarehouse.map((row) => row.warehouseId)).toEqual([
      fixture.mainWarehouseId,
    ]);
    expect(detail!.stockByWarehouse[0]?.quantity).toBe(10);
    expect(detail!.movements).toHaveLength(1);
    expect(detail!.movements[0]?.warehouseName).toBe("Principal");
  });

  it("filtre l'historique global des mouvements de stock", async () => {
    const fixture = await createFixture();
    const result = await listStockMovements(fixture.context, {});

    expect(result.total).toBe(1);
    expect(result.items[0]?.warehouseId).toBe(fixture.mainWarehouseId);
  });

  it("refuse la consultation des membres d'un entrepôt non accessible", async () => {
    const fixture = await createFixture();

    await expect(
      listWarehouseMembers(fixture.context, fixture.secondaryWarehouseId),
    ).rejects.toMatchObject({ status: 404, code: "warehouse_not_found" });
  });

  it("masque les transferts qui ne concernent aucun entrepôt accessible", async () => {
    const fixture = await createFixture();

    const inserted = await db
      .insert(warehouseTransfers)
      .values([
        {
          shopId: fixture.shopId,
          number: `TRF-ISO-${randomUUID().slice(0, 8)}`,
          fromWarehouseId: fixture.secondaryWarehouseId,
          toWarehouseId: fixture.thirdWarehouseId,
          status: "prepared" as const,
        },
        {
          shopId: fixture.shopId,
          number: `TRF-OK-${randomUUID().slice(0, 8)}`,
          fromWarehouseId: fixture.mainWarehouseId,
          toWarehouseId: fixture.secondaryWarehouseId,
          status: "prepared" as const,
        },
      ])
      .returning({ id: warehouseTransfers.id, number: warehouseTransfers.number });

    const hidden = inserted.find((row) => row.number.startsWith("TRF-ISO-"));
    const visible = inserted.find((row) => row.number.startsWith("TRF-OK-"));
    if (!hidden || !visible) throw new Error("Transferts non créés");

    await expect(getTransfer(fixture.context, hidden.id)).resolves.toBeNull();
    await expect(getTransfer(fixture.context, visible.id)).resolves.not.toBeNull();

    const list = await listTransfers(fixture.context, {});
    expect(list.items.map((row) => row.id)).toEqual([visible.id]);
  });
});

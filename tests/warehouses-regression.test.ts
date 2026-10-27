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
  users,
  warehouseStock,
  warehouses,
  type MemberRole,
  type Session,
} from "@/server/db/schema";
import { effectivePermissions } from "@/server/permissions";
import {
  applyWarehouseDelta,
  createWarehouse,
  getWarehouse,
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

describe.skipIf(!hasTestDatabase)("régression: table et gestion des entrepôts (warehouses)", () => {
  const db = getDb();

  afterAll(async () => {
    await closePool();
  });

  async function createFixture(label: string, role: MemberRole = "owner"): Promise<Fixture> {
    const suffix = `${Date.now()}-${randomUUID()}`;

    const [user] = await db
      .insert(users)
      .values({
        email: `reg-wh-${label}-${suffix}@example.test`,
        name: `Test Warehouse ${label}`,
      })
      .returning();
    if (!user) throw new Error("Utilisateur non créé");

    const [shop] = await db
      .insert(shops)
      .values({
        name: `Boutique Entrepôt ${label}`,
        slug: `reg-wh-${label}-${suffix}`,
        currency: "XOF",
        timezone: "Africa/Lome",
      })
      .returning();
    if (!shop) throw new Error("Boutique non créée");

    const [membership] = await db
      .insert(memberships)
      .values({ shopId: shop.id, userId: user.id, role })
      .returning();
    if (!membership) throw new Error("Adhésion non créée");

    await db.insert(shopSettings).values({ shopId: shop.id, invoicePrefix: "REG" });
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
    if (!warehouse) throw new Error("Entrepôt non créé");

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

  it("la table warehouses existe et permet de lister les entrepôts actifs", async () => {
    const fixture = await createFixture("list");
    const list = await listWarehouses(fixture.shopId);

    expect(list.length).toBeGreaterThanOrEqual(1);
    const main = list.find((w) => w.id === fixture.warehouseId);
    expect(main).toBeDefined();
    expect(main!.code).toBe("MAIN");
    expect(main!.isDefault).toBe(true);
    expect(main!.isActive).toBe(true);
    expect(main!.archivedAt).toBeNull();
  });

  it("resolveWarehouse renvoie l'entrepôt par défaut lorsqu'aucun n'est spécifié", async () => {
    const fixture = await createFixture("default");
    const resolved = await resolveWarehouse(fixture.context);

    expect(resolved.id).toBe(fixture.warehouseId);
    expect(resolved.isDefault).toBe(true);
  });

  it("crée un deuxième entrepôt avec validation du code et isolation par entreprise", async () => {
    const fixture = await createFixture("create-second");

    const second = await createWarehouse(fixture.context, {
      name: "Dépôt Annexe",
      code: "ANNEXE",
      address: null,
      isDefault: false,
    });

    expect(second.id).toBeDefined();

    const fetched = await getWarehouse(fixture.shopId, second.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.name).toBe("Dépôt Annexe");
    expect(fetched!.code).toBe("ANNEXE");
    expect(fetched!.isDefault).toBe(false);

    // Tentative de créer un entrepôt avec le même code dans la même boutique -> doit échouer (conflit 409)
    await expect(
      createWarehouse(fixture.context, {
        name: "Doublon",
        code: "ANNEXE",
        address: null,
        isDefault: false,
      }),
    ).rejects.toMatchObject({ status: 409, code: "warehouse_code_taken" });
  });

  it("refuse l'accès à un entrepôt appartenant à une autre boutique", async () => {
    const fixtureA = await createFixture("shop-a");
    const fixtureB = await createFixture("shop-b");

    // L'utilisateur de la boutique A ne doit pas pouvoir résoudre l'entrepôt de la boutique B
    await expect(
      resolveWarehouse(fixtureA.context, fixtureB.warehouseId),
    ).rejects.toMatchObject({ status: 404, code: "warehouse_not_found" });
  });

  it("empêche d'archiver le dernier entrepôt actif d'une boutique", async () => {
    const fixture = await createFixture("archive-last");

    await expect(
      setWarehouseArchived(fixture.context, fixture.warehouseId, true),
    ).rejects.toMatchObject({ status: 409, code: "last_warehouse" });
  });

  it("applique les variations de stock atomiquement et rejette le stock négatif", async () => {
    const fixture = await createFixture("stock-delta");

    const [product] = await db
      .insert(products)
      .values({
        shopId: fixture.shopId,
        name: "Article Test",
        sku: `SKU-${Date.now()}`,
        priceCents: 1000,
        quantity: 10,
      })
      .returning();

    // Insérer le stock initial
    await db.insert(warehouseStock).values({
      shopId: fixture.shopId,
      warehouseId: fixture.warehouseId,
      productId: product!.id,
      quantity: 10,
    });

    // Décrémenter 3 unités -> stock = 7
    await db.transaction(async (tx) => {
      const newQty = await applyWarehouseDelta(tx, {
        shopId: fixture.shopId,
        warehouseId: fixture.warehouseId,
        productId: product!.id,
        delta: -3,
        productName: product!.name,
      });
      expect(newQty).toBe(7);
    });

    // Tenter de retirer 20 unités -> stock insuffisant (422)
    await expect(
      db.transaction(async (tx) => {
        await applyWarehouseDelta(tx, {
          shopId: fixture.shopId,
          warehouseId: fixture.warehouseId,
          productId: product!.id,
          delta: -20,
          productName: product!.name,
        });
      }),
    ).rejects.toMatchObject({ status: 422, code: "insufficient_stock" });
  });
});

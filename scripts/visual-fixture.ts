import "dotenv/config";
import { randomUUID } from "node:crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is required");
if (testUrl === process.env.DATABASE_URL) {
  throw new Error("Refusing to seed visual fixtures against the primary database");
}
process.env.DATABASE_URL = testUrl;

const { getDb, getPool } = await import("../src/server/db");
const {
  customers,
  memberships,
  products,
  sales,
  shops,
  stockMovements,
  users,
  warehouseStock,
  warehouses,
} = await import("../src/server/db/schema");
const { and, eq, sql } = await import("drizzle-orm");
const { hashPassword } = await import("../src/server/auth/password");
const { effectivePermissions } = await import("../src/server/permissions");
const { createSale, cancelSale } = await import("../src/server/services/sales");
type AuthContext = import("../src/server/auth/context").AuthContext;

const db = getDb();

try {
  const shopRows = await db.select().from(shops).where(eq(shops.slug, "maison-lumen-demo")).limit(1);
  const shop = shopRows[0];
  if (!shop) throw new Error("Demo shop not found. Run the seed first.");

  const email = "visual-check@example.test";
  const password = "VisualCheck2026!";
  const passwordHash = await hashPassword(password);
  const existingUser = await db.select().from(users).where(sql`lower(${users.email}) = lower(${email})`).limit(1);

  let user = existingUser[0];
  if (user) {
    const updated = await db
      .update(users)
      .set({ name: "Awa Diallo", passwordHash, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();
    user = updated[0]!;
  } else {
    const inserted = await db
      .insert(users)
      .values({ email, name: "Awa Diallo", passwordHash, emailVerifiedAt: new Date() })
      .returning();
    user = inserted[0]!;
  }

  await db.delete(memberships).where(and(eq(memberships.userId, user.id), sql`${memberships.shopId} <> ${shop.id}`));
  const existingMembership = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.shopId, shop.id), eq(memberships.userId, user.id)))
    .limit(1);

  const membership =
    existingMembership[0] ??
    (
      await db
        .insert(memberships)
        .values({ shopId: shop.id, userId: user.id, role: "owner" })
        .returning()
    )[0]!;

  if (membership.role !== "owner") {
    await db.update(memberships).set({ role: "owner", updatedAt: new Date() }).where(eq(memberships.id, membership.id));
  }

  const productRows = await db.select().from(products).where(eq(products.shopId, shop.id));
  if (productRows.length === 0) throw new Error("Demo shop has no products");

  let mainRows = await db.select().from(warehouses).where(and(eq(warehouses.shopId, shop.id), eq(warehouses.isDefault, true))).limit(1);
  let main = mainRows[0];
  if (!main) {
    main = (
      await db
        .insert(warehouses)
        .values({ shopId: shop.id, name: "Entrepôt principal", code: "MAIN", isDefault: true, isActive: true })
        .returning()
    )[0]!;
  }

  const extraWarehouses = [
    { code: "DEPOT", name: "Dépôt Nord", address: "Zone industrielle, Lomé" },
    { code: "BOUTIQUE", name: "Réserve boutique", address: "12 rue du Marché, Lomé" },
  ];
  const secondary: Array<{ id: string; code: string }> = [];
  for (const entry of extraWarehouses) {
    const found = await db.select().from(warehouses).where(and(eq(warehouses.shopId, shop.id), eq(warehouses.code, entry.code))).limit(1);
    const row =
      found[0] ??
      (
        await db
          .insert(warehouses)
          .values({ shopId: shop.id, name: entry.name, code: entry.code, address: entry.address, isDefault: false, isActive: true })
          .returning()
      )[0]!;
    secondary.push({ id: row.id, code: entry.code });
  }

  // Réassort du dépôt principal pour soutenir les ventes de démonstration.
  await db.transaction(async (tx) => {
    for (const product of productRows) {
      const result = await tx
        .update(warehouseStock)
        .set({ quantity: sql`${warehouseStock.quantity} + 60`, updatedAt: new Date() })
        .where(and(eq(warehouseStock.warehouseId, main.id), eq(warehouseStock.productId, product.id)))
        .returning({ quantity: warehouseStock.quantity });

      if (!result[0]) {
        await tx.insert(warehouseStock).values({ shopId: shop.id, warehouseId: main.id, productId: product.id, quantity: 60 });
      }

      await tx
        .update(products)
        .set({ quantity: sql`${products.quantity} + 60` })
        .where(eq(products.id, product.id));

      await tx.insert(stockMovements).values({
        shopId: shop.id,
        productId: product.id,
        warehouseId: main.id,
        userId: user.id,
        type: "in",
        quantityDelta: 60,
        reason: "Réassort vitrine",
      });
    }
  });

  // Stock réparti dans les entrepôts secondaires.
  const allocations: Record<string, number[]> = {
    DEPOT: [12, 0, 20, 0, 15, 8],
    BOUTIQUE: [0, 6, 0, 10, 5, 5],
  };
  await db.transaction(async (tx) => {
    for (const warehouse of secondary) {
      const quantities = allocations[warehouse.code] ?? [];
      for (const [index, quantity] of quantities.entries()) {
        if (!quantity) continue;
        const product = productRows[index];
        if (!product) continue;
        const found = await tx
          .select()
          .from(warehouseStock)
          .where(and(eq(warehouseStock.warehouseId, warehouse.id), eq(warehouseStock.productId, product.id)))
          .limit(1);
        if (found[0]) {
          await tx
            .update(warehouseStock)
            .set({ quantity: sql`${warehouseStock.quantity} + ${quantity}`, updatedAt: new Date() })
            .where(and(eq(warehouseStock.warehouseId, warehouse.id), eq(warehouseStock.productId, product.id)));
        } else {
          await tx.insert(warehouseStock).values({
            shopId: shop.id,
            warehouseId: warehouse.id,
            productId: product.id,
            quantity,
          });
        }
        await tx.update(products).set({ quantity: sql`${products.quantity} + ${quantity}` }).where(eq(products.id, product.id));
        await tx.insert(stockMovements).values({
          shopId: shop.id,
          productId: product.id,
          warehouseId: warehouse.id,
          userId: user.id,
          type: "in",
          quantityDelta: quantity,
          reason: `Stock initial ${warehouse.code}`,
        });
      }
    }
  });

  const customerSeeds = [
    { name: "Awa Koné", phone: "+228 90 11 22 33", email: "awa.kone@example.test", address: "Quartier Bè, Lomé" },
    { name: "Koffi Mensah", phone: "+228 91 22 33 44", email: "koffi.mensah@example.test", address: "Adidogomé, Lomé" },
    { name: "Fatou Traoré", phone: "+228 92 33 44 55", email: "fatou.traore@example.test", address: "Agoè, Lomé" },
    { name: "Yao Kouassi", phone: "+228 93 44 55 66", email: "yao.kouassi@example.test", address: "Hédzranawoé, Lomé" },
    { name: "Mariam Ouedraogo", phone: "+228 94 55 66 77", email: "mariam.ouedraogo@example.test", address: "Tokoin, Lomé" },
    { name: "Emmanuel Adjei", phone: "+228 95 66 77 88", email: "emmanuel.adjei@example.test", address: "Nyékonakpoè, Lomé" },
  ];

  const existingCustomers = await db.select().from(customers).where(eq(customers.shopId, shop.id));
  const customerByName = new Map(existingCustomers.map((customer) => [customer.name, customer]));
  for (const seed of customerSeeds) {
    if (customerByName.has(seed.name)) continue;
    const inserted = await db
      .insert(customers)
      .values({ shopId: shop.id, ...seed })
      .returning();
    if (inserted[0]) customerByName.set(inserted[0].name, inserted[0]);
  }
  const customerList = [...customerByName.values()];

  const context = {
    user,
    session: {} as AuthContext["session"],
    shop,
    membership,
    role: "owner" as const,
    permissions: effectivePermissions("owner", null),
    csrfToken: "visual-fixture",
  } satisfies AuthContext;

  const existingSales = await db.select({ id: sales.id }).from(sales).where(eq(sales.shopId, shop.id)).limit(1);
  if (existingSales[0]) {
    console.log("Demo shop already has sales; stock fixture completed without new sales.");
  } else {
    const paymentMethods = ["cash", "mobile_money", "card"] as const;
    const createdSaleIds: string[] = [];
    const now = new Date();

    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const saleCount = 2 + ((daysAgo + 2) % 3);
      for (let index = 0; index < saleCount; index++) {
        const itemCount = 1 + ((daysAgo + index) % 3);
        const items = Array.from({ length: itemCount }, (_, itemIndex) => {
          const product = productRows[(daysAgo * 2 + index + itemIndex) % productRows.length]!;
          return { productId: product.id, quantity: 1 + ((index + itemIndex) % 4) };
        });

        const customer =
          (daysAgo + index) % 3 === 0 ? null : customerList[(daysAgo + index) % customerList.length] ?? null;

        const result = await createSale(
          context,
          {
            items,
            customerId: customer?.id ?? null,
            discountCents: index === 1 ? 500 : 0,
            paymentMethod: paymentMethods[(daysAgo + index) % paymentMethods.length]!,
            note: null,
            reference: null,
            idempotencyKey: `visual-${randomUUID()}`,
          },
          main.id,
        );

        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - daysAgo);
        createdAt.setHours(8 + index * 2, (index * 13) % 60, 0, 0);

        await db.update(sales).set({ createdAt }).where(eq(sales.id, result.id));
        await db
          .update(stockMovements)
          .set({ createdAt })
          .where(eq(stockMovements.saleId, result.id));
        createdSaleIds.push(result.id);
      }
    }

    // Une vente annulée récente pour montrer les deux états dans l'interface.
    const cancelledId = createdSaleIds[createdSaleIds.length - 1];
    if (cancelledId) {
      await cancelSale(context, cancelledId, "Erreur de saisie (démonstration)");
    }
  }

  // Invariant : le cache produit reste la somme des entrepôts.
  await db.execute(sql`
    update products p
    set quantity = coalesce((
      select sum(ws.quantity)::int from warehouse_stock ws where ws.product_id = p.id
    ), 0)
    where p.shop_id = ${shop.id}
  `);

  const totals = await db
    .select({
      products: sql<number>`count(*)::int`,
      units: sql<number>`coalesce(sum(${products.quantity}), 0)::int`,
    })
    .from(products)
    .where(eq(products.shopId, shop.id));
  const salesTotals = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(sales)
    .where(eq(sales.shopId, shop.id));

  console.log(`visual shop: ${shop.name} (${shop.slug})`);
  console.log(`visual user: ${email}`);
  console.log(`password: ${password}`);
  console.log(`products: ${totals[0]?.products ?? 0}, units: ${totals[0]?.units ?? 0}, sales: ${salesTotals[0]?.total ?? 0}`);
} finally {
  await getPool().end();
}

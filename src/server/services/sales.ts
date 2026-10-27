import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { isUuid } from "@/lib/uuid";
import { isValidIsoDate } from "@/lib/date";
import {
  customers,
  payments,
  products,
  saleCounters,
  saleItems,
  sales,
  shopSettings,
  stockMovements,
  users,
  warehouseStock,
  warehouses,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import type { SaleCreateInput } from "@/server/validation/sales";
import {
  applyProductTotalDelta,
  applyWarehouseDelta,
  resolveWarehouse,
} from "@/server/services/warehouses";

const PAGE_SIZE = 20;

export interface SalesListFilters {
  q?: string;
  status?: "all" | "completed" | "cancelled";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function getSaleDetail(shopId: string, saleId: string) {
  if (!isUuid(saleId)) return null;

  const rows = await getDb()
    .select({
      sale: sales,
      customerName: customers.name,
      customerPhone: customers.phone,
      cashierName: users.name,
      warehouseName: warehouses.name,
      warehouseCode: warehouses.code,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .leftJoin(users, eq(users.id, sales.cashierId))
    .leftJoin(warehouses, eq(warehouses.id, sales.warehouseId))
    .where(and(eq(sales.id, saleId), eq(sales.shopId, shopId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const [items, paymentRows] = await Promise.all([
    getDb()
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))
      .orderBy(asc(saleItems.productName)),
    getDb()
      .select()
      .from(payments)
      .where(eq(payments.saleId, saleId))
      .orderBy(asc(payments.createdAt)),
  ]);

  return { ...row, items, payments: paymentRows };
}

export async function listSales(shopId: string, filters: SalesListFilters = {}) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));
  const conditions = [eq(sales.shopId, shopId)];

  if (filters.status === "completed" || filters.status === "cancelled") {
    conditions.push(eq(sales.status, filters.status));
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(ilike(sales.number, pattern), ilike(customers.name, pattern));
    if (search) conditions.push(search);
  }
  if (filters.from && isValidIsoDate(filters.from)) {
    conditions.push(gte(sales.createdAt, new Date(`${filters.from}T00:00:00`)));
  }
  if (filters.to && isValidIsoDate(filters.to)) {
    conditions.push(lte(sales.createdAt, new Date(`${filters.to}T23:59:59.999`)));
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        number: sales.number,
        status: sales.status,
        subtotalCents: sales.subtotalCents,
        discountCents: sales.discountCents,
        totalCents: sales.totalCents,
        createdAt: sales.createdAt,
        customerName: customers.name,
        warehouseName: warehouses.name,
        warehouseCode: warehouses.code,
        itemCount: sql<number>`(select count(*)::int from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
        paymentMethod: sql<string | null>`(
          select ${payments.method} from ${payments}
          where ${payments.saleId} = ${sales.id}
          order by ${payments.createdAt} asc limit 1
        )`,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .leftJoin(warehouses, eq(warehouses.id, sales.warehouseId))
      .where(where)
      .orderBy(desc(sales.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSalesStats(shopId: string, timezone: string) {
  const isToday = sql`(${sales.createdAt} at time zone ${timezone})::date = (now() at time zone ${timezone})::date`;
  const rows = await getDb()
    .select({
      todayCount: sql<number>`count(*) filter (where ${isToday} and ${sales.status} = 'completed')::int`,
      todayRevenue: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${isToday} and ${sales.status} = 'completed'), 0)::text`,
      monthCount: sql<number>`count(*) filter (where ${sales.createdAt} >= date_trunc('month', now()) and ${sales.status} = 'completed')::int`,
      monthRevenue: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.createdAt} >= date_trunc('month', now()) and ${sales.status} = 'completed'), 0)::text`,
      cancelledCount: sql<number>`count(*) filter (where ${sales.status} = 'cancelled')::int`,
    })
    .from(sales)
    .where(eq(sales.shopId, shopId));

  const row = rows[0];
  return {
    todayCount: row?.todayCount ?? 0,
    todayRevenue: Number(row?.todayRevenue ?? 0),
    monthCount: row?.monthCount ?? 0,
    monthRevenue: Number(row?.monthRevenue ?? 0),
    cancelledCount: row?.cancelledCount ?? 0,
  };
}

export async function createSale(
  context: AuthContext,
  input: SaleCreateInput,
  requestedWarehouseId?: string | null,
): Promise<{ id: string; number: string; totalCents: number }> {
  const db = getDb();
  const warehouse = await resolveWarehouse(context, requestedWarehouseId);

  const existing = await db
    .select({ id: sales.id, number: sales.number, totalCents: sales.totalCents })
    .from(sales)
    .where(
      and(eq(sales.shopId, context.shop.id), eq(sales.idempotencyKey, input.idempotencyKey)),
    )
    .limit(1);

  if (existing[0]) return existing[0];

  if (input.discountCents > 0 && !context.permissions.has("discounts.apply")) {
    throw new ApiError(
      403,
      "discount_forbidden",
      "Vous n'avez pas la permission d'appliquer une remise.",
    );
  }

  const merged = new Map<string, number>();
  for (const item of input.items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  const requestedItems = [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  try {
    return await db.transaction(async (tx) => {
      const duplicate = await tx
        .select({ id: sales.id, number: sales.number, totalCents: sales.totalCents })
        .from(sales)
        .where(
          and(
            eq(sales.shopId, context.shop.id),
            eq(sales.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);

      if (duplicate[0]) return duplicate[0];

      if (input.customerId) {
        const customer = await tx
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.id, input.customerId),
              eq(customers.shopId, context.shop.id),
            ),
          )
          .limit(1);
        if (!customer[0]) {
          throw new ApiError(422, "invalid_customer", "Client introuvable.");
        }
      }

      const productRows = await tx
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          priceCents: products.priceCents,
          costCents: products.costCents,
          quantity: products.quantity,
          isArchived: products.isArchived,
        })
        .from(products)
        .where(
          and(
            eq(products.shopId, context.shop.id),
            inArray(
              products.id,
              requestedItems.map((item) => item.productId),
            ),
          ),
        )
        .orderBy(asc(products.id))
        .for("update");

      const productMap = new Map(productRows.map((product) => [product.id, product]));

      const stockRows = await tx
        .select({
          productId: warehouseStock.productId,
          quantity: warehouseStock.quantity,
        })
        .from(warehouseStock)
        .where(
          and(
            eq(warehouseStock.shopId, context.shop.id),
            eq(warehouseStock.warehouseId, warehouse.id),
            inArray(
              warehouseStock.productId,
              requestedItems.map((item) => item.productId),
            ),
          ),
        );
      const stockMap = new Map(
        stockRows.map((row) => [row.productId, row.quantity]),
      );

      for (const item of requestedItems) {
        const product = productMap.get(item.productId);
        if (!product || product.isArchived) {
          throw new ApiError(
            422,
            "invalid_product",
            "Un produit du panier est introuvable ou archivé.",
          );
        }
        const available = stockMap.get(item.productId) ?? 0;
        if (available < item.quantity) {
          throw new ApiError(
            422,
            "insufficient_stock",
            `Stock insuffisant pour « ${product.name} » dans l'entrepôt ${warehouse.name} : ${available} disponible(s).`,
          );
        }
      }

      const subtotalCents = requestedItems.reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        return sum + product.priceCents * item.quantity;
      }, 0);

      if (input.discountCents > subtotalCents) {
        throw new ApiError(
          422,
          "invalid_discount",
          "La remise ne peut pas dépasser le sous-total.",
        );
      }

      const totalCents = subtotalCents - input.discountCents;
      if (totalCents <= 0) {
        throw new ApiError(422, "invalid_total", "Le total de la vente doit être positif.");
      }

      const costCents = requestedItems.reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        return sum + (product.costCents ?? 0) * item.quantity;
      }, 0);

      await tx.insert(saleCounters).values({ shopId: context.shop.id }).onConflictDoNothing();
      const counterRows = await tx
        .select()
        .from(saleCounters)
        .where(eq(saleCounters.shopId, context.shop.id))
        .limit(1)
        .for("update");

      const counter = counterRows[0];
      if (!counter) throw new Error("Compteur de ventes introuvable");
      const nextNumber = counter.lastNumber + 1;
      await tx
        .update(saleCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(saleCounters.shopId, context.shop.id));

      const settingsRows = await tx
        .select({ invoicePrefix: shopSettings.invoicePrefix })
        .from(shopSettings)
        .where(eq(shopSettings.shopId, context.shop.id))
        .limit(1);
      const prefix = settingsRows[0]?.invoicePrefix?.trim() || "VTE";
      const number = `${prefix}-${String(nextNumber).padStart(6, "0")}`;

      const [sale] = await tx
        .insert(sales)
        .values({
          shopId: context.shop.id,
          number,
          warehouseId: warehouse.id,
          customerId: input.customerId,
          cashierId: context.user.id,
          subtotalCents,
          discountCents: input.discountCents,
          totalCents,
          costCents,
          currency: context.shop.currency,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
        })
        .returning({ id: sales.id, number: sales.number, totalCents: sales.totalCents });

      if (!sale) throw new Error("Création de la vente impossible");

      for (const item of requestedItems) {
        const product = productMap.get(item.productId)!;
        const lineTotalCents = product.priceCents * item.quantity;

        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          unitCostCents: product.costCents,
          lineTotalCents,
        });

        await applyWarehouseDelta(tx, {
          shopId: context.shop.id,
          warehouseId: warehouse.id,
          productId: product.id,
          delta: -item.quantity,
          productName: product.name,
        });

        await applyProductTotalDelta(tx, {
          shopId: context.shop.id,
          productId: product.id,
          delta: -item.quantity,
        });

        await tx.insert(stockMovements).values({
          shopId: context.shop.id,
          productId: product.id,
          warehouseId: warehouse.id,
          userId: context.user.id,
          saleId: sale.id,
          type: "sale",
          quantityDelta: -item.quantity,
          reason: `Vente ${number}`,
        });
      }

      await tx.insert(payments).values({
        shopId: context.shop.id,
        saleId: sale.id,
        method: input.paymentMethod,
        amountCents: totalCents,
        status: "recorded",
        reference: input.reference,
        createdBy: context.user.id,
      });

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "sale.created",
        entityType: "sale",
        entityId: sale.id,
        metadata: {
          number,
          totalCents,
          itemCount: requestedItems.length,
          paymentMethod: input.paymentMethod,
        },
      });

      return sale;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const duplicate = await db
        .select({ id: sales.id, number: sales.number, totalCents: sales.totalCents })
        .from(sales)
        .where(
          and(
            eq(sales.shopId, context.shop.id),
            eq(sales.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (duplicate[0]) return duplicate[0];
    }
    throw error;
  }
}

export async function cancelSale(
  context: AuthContext,
  saleId: string,
  reason: string,
): Promise<void> {
  if (!isUuid(saleId)) {
    throw new ApiError(404, "sale_not_found", "Vente introuvable.");
  }

  const db = getDb();

  await db.transaction(async (tx) => {
    const saleRows = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.shopId, context.shop.id)))
      .limit(1)
      .for("update");

    const sale = saleRows[0];
    if (!sale) throw new ApiError(404, "sale_not_found", "Vente introuvable.");
    if (sale.status === "cancelled") {
      throw new ApiError(409, "sale_already_cancelled", "Cette vente est déjà annulée.");
    }

    // On restaure dans l'entrepôt d'origine, même s'il a été archivé depuis.
    let warehouseId = sale.warehouseId;
    if (warehouseId) {
      const warehouseRows = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, warehouseId),
            eq(warehouses.shopId, context.shop.id),
          ),
        )
        .limit(1);
      if (!warehouseRows[0]) {
        throw new ApiError(
          409,
          "warehouse_not_found",
          "L'entrepôt d'origine de cette vente est introuvable.",
        );
      }
    } else {
      warehouseId = (await resolveWarehouse(context)).id;
    }

    const items = await tx
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId))
      .orderBy(asc(saleItems.productId));

    for (const item of items) {
      if (!item.productId) continue;

      const productRows = await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(eq(products.id, item.productId), eq(products.shopId, context.shop.id)),
        )
        .limit(1)
        .for("update");

      if (!productRows[0]) continue;

      await applyWarehouseDelta(tx, {
        shopId: context.shop.id,
        warehouseId,
        productId: item.productId,
        delta: item.quantity,
      });

      await applyProductTotalDelta(tx, {
        shopId: context.shop.id,
        productId: item.productId,
        delta: item.quantity,
      });

      const originalMovement = await tx
        .select({ id: stockMovements.id })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.saleId, saleId),
            eq(stockMovements.productId, item.productId),
            eq(stockMovements.type, "sale"),
          ),
        )
        .limit(1);

      await tx.insert(stockMovements).values({
        shopId: context.shop.id,
        productId: item.productId,
        warehouseId,
        userId: context.user.id,
        saleId,
        reversalOfId: originalMovement[0]?.id ?? null,
        type: "reversal",
        quantityDelta: item.quantity,
        reason: `Annulation ${sale.number} — ${reason}`,
      });
    }

    await tx
      .update(sales)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: context.user.id,
        cancelReason: reason,
      })
      .where(and(eq(sales.id, saleId), eq(sales.shopId, context.shop.id)));

    await tx
      .update(payments)
      .set({ status: "refunded" })
      .where(and(eq(payments.saleId, saleId), eq(payments.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "sale.cancelled",
      entityType: "sale",
      entityId: saleId,
      metadata: { number: sale.number, reason, totalCents: sale.totalCents },
    });
  });
}

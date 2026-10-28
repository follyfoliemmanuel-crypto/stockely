import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import {
  products,
  stockMovements,
  users,
  warehouseStock,
  warehouses,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type { StockMovementInput } from "@/server/validation/stock";
import {
  applyProductTotalDelta,
  applyWarehouseDelta,
  ensureWarehouseStockRow,
  getWarehouseQuantity,
  listAccessibleWarehouses,
  resolveWarehouse,
} from "@/server/services/warehouses";

const PAGE_SIZE = 25;
const MOVEMENT_TYPES = new Set<string>([
  "in",
  "out",
  "adjustment",
  "sale",
  "customer_return",
  "supplier_return",
  "reversal",
]);
const REASON_DEFAULT = {
  in: "Entrée manuelle",
  out: "Sortie manuelle",
  adjustment: "Correction d'inventaire",
} as const;

export interface StockListFilters {
  q?: string;
  productId?: string;
  warehouseId?: string;
  type?:
    | "in"
    | "out"
    | "adjustment"
    | "sale"
    | "customer_return"
    | "supplier_return"
    | "reversal";
  page?: number;
  pageSize?: number;
}

export async function listStockMovements(
  context: Pick<AuthContext, "shop" | "membership" | "role">,
  filters: StockListFilters = {},
) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));

  const accessible = await listAccessibleWarehouses(context);
  const allowedWarehouseIds = accessible.map((warehouse) => warehouse.id);
  const conditions = [
    eq(stockMovements.shopId, context.shop.id),
    or(
      isNull(stockMovements.warehouseId),
      allowedWarehouseIds.length > 0
        ? inArray(stockMovements.warehouseId, allowedWarehouseIds)
        : sql`false`,
    ),
  ];

  if (filters.productId && isUuid(filters.productId)) {
    conditions.push(eq(stockMovements.productId, filters.productId));
  }
  if (filters.warehouseId && isUuid(filters.warehouseId)) {
    conditions.push(eq(stockMovements.warehouseId, filters.warehouseId));
  }
  if (filters.type && MOVEMENT_TYPES.has(filters.type)) {
    conditions.push(eq(stockMovements.type, filters.type));
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(ilike(products.name, pattern), ilike(products.sku, pattern));
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantityDelta: stockMovements.quantityDelta,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        warehouseId: stockMovements.warehouseId,
        warehouseName: warehouses.name,
        userName: users.name,
        saleId: stockMovements.saleId,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .leftJoin(users, eq(users.id, stockMovements.userId))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
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

export async function getStockStats(shopId: string, warehouseId?: string) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const conditions = [
    eq(stockMovements.shopId, shopId),
    gte(stockMovements.createdAt, since),
  ];
  if (warehouseId && isUuid(warehouseId)) {
    conditions.push(eq(stockMovements.warehouseId, warehouseId));
  }

  const rows = await getDb()
    .select({
      entries: sql<number>`coalesce(sum(${stockMovements.quantityDelta}) filter (where ${stockMovements.quantityDelta} > 0), 0)::int`,
      exits: sql<number>`coalesce(abs(sum(${stockMovements.quantityDelta}) filter (where ${stockMovements.quantityDelta} < 0)), 0)::int`,
    })
    .from(stockMovements)
    .where(and(...conditions));

  return {
    entries: rows[0]?.entries ?? 0,
    exits: rows[0]?.exits ?? 0,
  };
}

export async function recordStockMovement(
  context: AuthContext,
  input: StockMovementInput,
  warehouseId?: string | null,
): Promise<{
  movementId: string;
  newQuantity: number;
  delta: number;
  warehouseId: string;
}> {
  const db = getDb();
  const warehouse = await resolveWarehouse(context, warehouseId);

  if (input.idempotencyKey) {
    const previous = await db
      .select({
        id: stockMovements.id,
        quantityDelta: stockMovements.quantityDelta,
        warehouseId: stockMovements.warehouseId,
      })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.shopId, context.shop.id),
          eq(stockMovements.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (previous[0]) {
      const quantityRows = await db
        .select({ quantity: warehouseStock.quantity })
        .from(warehouseStock)
        .where(
          and(
            eq(warehouseStock.warehouseId, warehouse.id),
            eq(warehouseStock.productId, input.productId),
          ),
        )
        .limit(1);
      return {
        movementId: previous[0].id,
        newQuantity: quantityRows[0]?.quantity ?? 0,
        delta: previous[0].quantityDelta,
        warehouseId: previous[0].warehouseId ?? warehouse.id,
      };
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: products.id,
          name: products.name,
          quantity: products.quantity,
          costCents: products.costCents,
        })
        .from(products)
        .where(
          and(
            eq(products.id, input.productId),
            eq(products.shopId, context.shop.id),
            eq(products.isArchived, false),
          ),
        )
        .limit(1)
        .for("update");

      const product = rows[0];
      if (!product) {
        throw new ApiError(
          404,
          "product_not_found",
          "Produit introuvable ou archivé.",
        );
      }

      await ensureWarehouseStockRow(tx, {
        shopId: context.shop.id,
        warehouseId: warehouse.id,
        productId: product.id,
      });

      const current = await getWarehouseQuantity(tx, warehouse.id, product.id);
      const delta =
        input.type === "in"
          ? input.quantity
          : input.type === "out"
            ? -input.quantity
            : input.quantity - current;

      if (delta === 0) {
        throw new ApiError(
          422,
          "no_stock_change",
          "La quantité indiquée correspond déjà au stock de cet entrepôt.",
        );
      }

      const newQuantity = await applyWarehouseDelta(tx, {
        shopId: context.shop.id,
        warehouseId: warehouse.id,
        productId: product.id,
        delta,
        productName: product.name,
      });

      await applyProductTotalDelta(tx, {
        shopId: context.shop.id,
        productId: product.id,
        delta,
      });

      if (input.type === "in" && input.unitCostCents != null) {
        await tx
          .update(products)
          .set({ costCents: input.unitCostCents, updatedAt: new Date() })
          .where(
            and(
              eq(products.id, product.id),
              eq(products.shopId, context.shop.id),
            ),
          );
      }

      const [movement] = await tx
        .insert(stockMovements)
        .values({
          shopId: context.shop.id,
          productId: product.id,
          warehouseId: warehouse.id,
          userId: context.user.id,
          type: input.type,
          quantityDelta: delta,
          reason: input.reason ?? REASON_DEFAULT[input.type],
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning({ id: stockMovements.id });

      if (!movement) throw new Error("Mouvement de stock non créé");

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: `stock.${input.type}`,
        entityType: "product",
        entityId: product.id,
        metadata: {
          delta,
          newQuantity,
          warehouseId: warehouse.id,
          warehouseCode: warehouse.code,
          reason: input.reason ?? REASON_DEFAULT[input.type],
        },
      });

      return {
        movementId: movement.id,
        newQuantity,
        delta,
        warehouseId: warehouse.id,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error) && input.idempotencyKey) {
      const previous = await db
        .select({
          id: stockMovements.id,
          quantityDelta: stockMovements.quantityDelta,
          warehouseId: stockMovements.warehouseId,
        })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.shopId, context.shop.id),
            eq(stockMovements.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (previous[0]) {
        const quantityRows = await db
          .select({ quantity: warehouseStock.quantity })
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.warehouseId, previous[0].warehouseId ?? warehouse.id),
              eq(warehouseStock.productId, input.productId),
            ),
          )
          .limit(1);
        return {
          movementId: previous[0].id,
          newQuantity: quantityRows[0]?.quantity ?? 0,
          delta: previous[0].quantityDelta,
          warehouseId: previous[0].warehouseId ?? warehouse.id,
        };
      }
    }
    throw error;
  }
}

/**
 * Produits avec la quantité de l'entrepôt demandé.
 * Sans entrepôt, renvoie le total (cache `products.quantity`).
 */
export async function listStockProductOptions(shopId: string, warehouseId?: string) {
  const quantity = warehouseId
    ? sql<number>`coalesce(${warehouseStock.quantity}, 0)`
    : sql<number>`${products.quantity}`;

  let query = getDb()
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      quantity,
      costCents: products.costCents,
      minStock: products.minStock,
    })
    .from(products)
    .$dynamic();

  if (warehouseId) {
    query = query.leftJoin(
      warehouseStock,
      and(
        eq(warehouseStock.productId, products.id),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    );
  }

  return query
    .where(and(eq(products.shopId, shopId), eq(products.isArchived, false)))
    .orderBy(asc(products.name));
}

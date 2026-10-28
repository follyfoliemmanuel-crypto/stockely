import {
  and,
  asc,
  count,
  desc,
  eq,
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
import { isUuid } from "@/lib/uuid";
import {
  categories,
  products,
  stockMovements,
  suppliers,
  users,
  warehouseStock,
  warehouses,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import type {
  ProductCreateInput,
  ProductUpdateInput,
} from "@/server/validation/catalog";
import {
  listAccessibleWarehouses,
  resolveWarehouse,
} from "@/server/services/warehouses";

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  stock?: "all" | "low" | "out" | "ok";
  archived?: "active" | "archived" | "all";
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

export interface ProductListItem {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  priceCents: number;
  costCents: number | null;
  quantity: number;
  minStock: number;
  isArchived: boolean;
  categoryName: string | null;
  supplierName: string | null;
  updatedAt: Date;
}

/** Quantité affichée : entrepôt sélectionné, sinon total (cache) du produit. */
function stockQuantityExpression(warehouseId?: string) {
  return warehouseId
    ? sql<number>`coalesce(${warehouseStock.quantity}, 0)`
    : sql<number>`${products.quantity}`;
}

function buildProductWhere(
  shopId: string,
  filters: ProductListFilters,
  warehouseId?: string,
) {
  const conditions = [eq(products.shopId, shopId)];
  const stockQuantity = stockQuantityExpression(warehouseId);

  if ((filters.archived ?? "active") === "active") {
    conditions.push(eq(products.isArchived, false));
  } else if (filters.archived === "archived") {
    conditions.push(eq(products.isArchived, true));
  }

  if (filters.categoryId && isUuid(filters.categoryId)) {
    conditions.push(eq(products.categoryId, filters.categoryId));
  }

  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(
      ilike(products.name, pattern),
      ilike(products.sku, pattern),
      ilike(products.barcode, pattern),
    );
    if (search) conditions.push(search);
  }

  switch (filters.stock) {
    case "out":
      conditions.push(sql`${stockQuantity} = 0`);
      break;
    case "low":
      conditions.push(
        sql`${stockQuantity} > 0 and ${stockQuantity} <= ${products.minStock}`,
      );
      break;
    case "ok":
      conditions.push(sql`${stockQuantity} > ${products.minStock}`);
      break;
  }

  return and(...conditions);
}

export async function listProducts(
  shopId: string,
  filters: ProductListFilters = {},
  warehouseId?: string,
): Promise<{
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = buildProductWhere(shopId, filters, warehouseId);

  let rowsQuery = db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      priceCents: products.priceCents,
      costCents: products.costCents,
      quantity: stockQuantityExpression(warehouseId),
      minStock: products.minStock,
      isArchived: products.isArchived,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      supplierName: suppliers.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .$dynamic();

  let totalQuery = db.select({ total: count() }).from(products).$dynamic();

  if (warehouseId) {
    const joinStock = and(
      eq(warehouseStock.productId, products.id),
      eq(warehouseStock.warehouseId, warehouseId),
    );
    rowsQuery = rowsQuery.leftJoin(warehouseStock, joinStock);
    totalQuery = totalQuery.leftJoin(warehouseStock, joinStock);
  }

  const [rows, totalRows] = await Promise.all([
    rowsQuery
      .where(where)
      .orderBy(asc(products.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    totalQuery.where(where),
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

export async function listCategoriesWithCounts(shopId: string) {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      productCount: sql<number>`count(${products.id})::int`,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), eq(products.isArchived, false)),
    )
    .where(eq(categories.shopId, shopId))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

export async function listProductOptions(shopId: string, warehouseId?: string) {
  const quantity = stockQuantityExpression(warehouseId);
  let query = getDb()
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      quantity,
      priceCents: products.priceCents,
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

export async function getProductStats(shopId: string, warehouseId?: string) {
  const stockQuantity = stockQuantityExpression(warehouseId);
  let query = getDb()
    .select({
      total: count(),
      units: sql<number>`coalesce(sum(${stockQuantity}), 0)::int`,
      valueCents: sql<string>`coalesce(sum(${stockQuantity} * coalesce(${products.costCents}, ${products.priceCents})), 0)::text`,
      out: sql<number>`count(*) filter (where ${stockQuantity} = 0)::int`,
      low: sql<number>`count(*) filter (where ${stockQuantity} > 0 and ${stockQuantity} <= ${products.minStock})::int`,
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

  const rows = await query.where(
    and(eq(products.shopId, shopId), eq(products.isArchived, false)),
  );

  const archivedRows = await getDb()
    .select({ archived: count() })
    .from(products)
    .where(and(eq(products.shopId, shopId), eq(products.isArchived, true)));

  const row = rows[0];
  return {
    total: Number(row?.total ?? 0),
    units: row?.units ?? 0,
    valueCents: Number(row?.valueCents ?? 0),
    out: row?.out ?? 0,
    low: row?.low ?? 0,
    archived: Number(archivedRows[0]?.archived ?? 0),
  };
}

async function assertReferences(
  shopId: string,
  input: Pick<ProductCreateInput, "categoryId" | "supplierId">,
): Promise<void> {
  const db = getDb();

  if (input.categoryId) {
    const rows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.shopId, shopId)))
      .limit(1);
    if (!rows[0]) {
      throw new ApiError(422, "invalid_category", "Catégorie introuvable.");
    }
  }

  if (input.supplierId) {
    const rows = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.shopId, shopId)))
      .limit(1);
    if (!rows[0]) {
      throw new ApiError(422, "invalid_supplier", "Fournisseur introuvable.");
    }
  }
}

function uniqueProductMessage(): ApiError {
  return new ApiError(
    409,
    "product_conflict",
    "Un produit avec ce SKU ou ce code-barres existe déjà dans cette boutique.",
  );
}

export async function createProduct(
  context: AuthContext,
  input: ProductCreateInput,
  warehouseId?: string | null,
): Promise<{ id: string }> {
  const db = getDb();
  const warehouse = await resolveWarehouse(context, warehouseId);

  try {
    return await db.transaction(async (tx) => {
      await assertReferences(context.shop.id, input);

      const [product] = await tx
        .insert(products)
        .values({
          shopId: context.shop.id,
          categoryId: input.categoryId,
          supplierId: input.supplierId,
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          description: input.description,
          costCents: input.costCents,
          priceCents: input.priceCents,
          quantity: input.initialQuantity,
          minStock: input.minStock,
        })
        .returning({ id: products.id, name: products.name });

      if (!product) throw new Error("Création du produit impossible");

      await tx.insert(warehouseStock).values({
        shopId: context.shop.id,
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: input.initialQuantity,
      });

      if (input.initialQuantity > 0) {
        await tx.insert(stockMovements).values({
          shopId: context.shop.id,
          productId: product.id,
          warehouseId: warehouse.id,
          userId: context.user.id,
          type: "in",
          quantityDelta: input.initialQuantity,
          reason: "Stock initial",
        });
      }

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "product.created",
        entityType: "product",
        entityId: product.id,
        metadata: { name: product.name, sku: input.sku },
      });

      return { id: product.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw uniqueProductMessage();
    throw error;
  }
}

export async function updateProduct(
  context: AuthContext,
  productId: string,
  input: ProductUpdateInput,
): Promise<void> {
  const db = getDb();
  const existing = await getProduct(context.shop.id, productId);
  if (!existing) throw new ApiError(404, "product_not_found", "Produit introuvable.");

  try {
    await db.transaction(async (tx) => {
      await assertReferences(context.shop.id, input);

      await tx
        .update(products)
        .set({
          categoryId: input.categoryId,
          supplierId: input.supplierId,
          name: input.name,
          sku: input.sku,
          barcode: input.barcode,
          description: input.description,
          costCents: input.costCents,
          priceCents: input.priceCents,
          minStock: input.minStock,
          updatedAt: new Date(),
        })
        .where(and(eq(products.id, productId), eq(products.shopId, context.shop.id)));

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "product.updated",
        entityType: "product",
        entityId: productId,
        metadata: { name: input.name, sku: input.sku },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw uniqueProductMessage();
    throw error;
  }
}

export async function setProductArchived(
  context: AuthContext,
  productId: string,
  archived: boolean,
): Promise<void> {
  const db = getDb();
  const existing = await getProduct(context.shop.id, productId);
  if (!existing) throw new ApiError(404, "product_not_found", "Produit introuvable.");

  await db.transaction(async (tx) => {
    await tx
      .update(products)
      .set({
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, productId), eq(products.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: archived ? "product.archived" : "product.restored",
      entityType: "product",
      entityId: productId,
      metadata: { name: existing.product.name },
    });
  });
}

export async function getProduct(shopId: string, productId: string) {
  if (!isUuid(productId)) return null;

  const rows = await getDb()
    .select({
      product: products,
      categoryName: categories.name,
      supplierName: suppliers.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getProductDetail(
  context: Pick<AuthContext, "shop" | "membership" | "role">,
  productId: string,
) {
  const row = await getProduct(context.shop.id, productId);
  if (!row) return null;

  // Ne jamais exposer les mouvements ni les quantités des entrepôts
  // auxquels le membre n'a pas accès. Les mouvements historiques sans
  // entrepôt (antérieurs au multi-entrepôts) restent consultables.
  const accessible = await listAccessibleWarehouses(context);
  const allowedWarehouseIds = accessible.map((warehouse) => warehouse.id);
  if (allowedWarehouseIds.length === 0) {
    return { ...row, movements: [], stockByWarehouse: [] };
  }

  const movements = await getDb()
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantityDelta: stockMovements.quantityDelta,
      reason: stockMovements.reason,
      createdAt: stockMovements.createdAt,
      saleId: stockMovements.saleId,
      warehouseName: warehouses.name,
      userName: users.name,
    })
    .from(stockMovements)
    .leftJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
    .leftJoin(users, eq(users.id, stockMovements.userId))
    .where(
      and(
        eq(stockMovements.shopId, context.shop.id),
        eq(stockMovements.productId, productId),
        or(
          isNull(stockMovements.warehouseId),
          inArray(stockMovements.warehouseId, allowedWarehouseIds),
        ),
      ),
    )
    .orderBy(desc(stockMovements.createdAt))
    .limit(25);

  const stockByWarehouse = await getDb()
    .select({
      warehouseId: warehouses.id,
      warehouseName: warehouses.name,
      warehouseCode: warehouses.code,
      isDefault: warehouses.isDefault,
      quantity: warehouseStock.quantity,
    })
    .from(warehouseStock)
    .innerJoin(warehouses, eq(warehouses.id, warehouseStock.warehouseId))
    .where(
      and(
        eq(warehouseStock.shopId, context.shop.id),
        eq(warehouseStock.productId, productId),
        eq(warehouses.isActive, true),
        inArray(warehouseStock.warehouseId, allowedWarehouseIds),
      ),
    )
    .orderBy(desc(warehouses.isDefault), asc(warehouses.name));

  return { ...row, movements, stockByWarehouse };
}

export async function searchProducts(
  shopId: string,
  query: string,
  limit = 20,
  warehouseId?: string,
) {
  const db = getDb();
  const q = query.trim().slice(0, 100);
  const pattern = `%${q}%`;

  const where = q
    ? and(
        eq(products.shopId, shopId),
        eq(products.isArchived, false),
        or(
          ilike(products.name, pattern),
          ilike(products.sku, pattern),
          ilike(products.barcode, pattern),
        ),
      )
    : and(eq(products.shopId, shopId), eq(products.isArchived, false));

  let builder = db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      priceCents: products.priceCents,
      quantity: stockQuantityExpression(warehouseId),
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .$dynamic();

  if (warehouseId) {
    builder = builder.leftJoin(
      warehouseStock,
      and(
        eq(warehouseStock.productId, products.id),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    );
  }

  return builder
    .where(where)
    .orderBy(asc(products.name))
    .limit(Math.min(50, Math.max(1, limit)));
}

export async function findProductByBarcode(
  shopId: string,
  barcode: string,
  warehouseId?: string,
) {
  const normalized = barcode.trim().slice(0, 64);
  if (!normalized) return null;

  let builder = getDb()
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      priceCents: products.priceCents,
      quantity: stockQuantityExpression(warehouseId),
    })
    .from(products)
    .$dynamic();

  if (warehouseId) {
    builder = builder.leftJoin(
      warehouseStock,
      and(
        eq(warehouseStock.productId, products.id),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    );
  }

  const rows = await builder
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.isArchived, false),
        eq(products.barcode, normalized),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

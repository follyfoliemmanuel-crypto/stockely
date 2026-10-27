import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  customers,
  products,
  saleItems,
  sales,
  stockMovements,
  warehouseStock,
  warehouses,
} from "@/server/db/schema";

export interface DashboardOverview {
  productCount: number;
  stockUnits: number;
  stockValueCents: number;
  outOfStockCount: number;
  lowStockCount: number;
  salesTodayCount: number;
  revenueTodayCents: number;
  costTodayCents: number;
  monthRevenueCents: number;
  monthSalesCount: number;
  previousMonthRevenueCents: number;
  previousMonthSalesCount: number;
  salesSeries: Array<{
    date: string;
    revenueCents: number;
    count: number;
  }>;
  stockByWarehouse: Array<{
    id: string;
    name: string;
    code: string;
    units: number;
    valueCents: number;
  }>;
  recentSales: Array<{
    id: string;
    number: string;
    totalCents: number;
    status: "completed" | "cancelled";
    customerName: string | null;
    createdAt: Date;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    quantityDelta: number;
    productName: string;
    warehouseName: string | null;
    createdAt: Date;
  }>;
  topProducts: Array<{
    productId: string | null;
    name: string;
    quantity: number;
    revenueCents: number;
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    minStock: number;
  }>;
}

function dateKeyInTimeZone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function lastDateKeys(count: number, timezone: string): string[] {
  const today = dateKeyInTimeZone(new Date(), timezone);
  const [year = 1970, month = 1, day = 1] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      Date.UTC(year, month - 1, day - (count - 1 - index), 12),
    );
    return dateKeyInTimeZone(date, timezone);
  });
}

/**
 * Agrégats du tableau de bord, strictement limités à la boutique fournie.
 * La valeur du stock utilise le prix d'achat lorsqu'il est connu,
 * sinon le prix de vente (hypothèse conservatrice documentée).
 */
export async function getDashboardOverview(
  shopId: string,
  timezone: string,
  warehouseId?: string,
): Promise<DashboardOverview> {
  const db = getDb();

  const localDate = sql`(${sales.createdAt} at time zone ${timezone})::date`;
  const monthStart = sql`date_trunc('month', (now() at time zone ${timezone}))::date`;
  const previousMonthStart = sql`(date_trunc('month', (now() at time zone ${timezone})) - interval '1 month')::date`;
  const previousMonthEnd = sql`${previousMonthStart} + (extract(day from (now() at time zone ${timezone}))::int * interval '1 day')`;
  const isToday = sql`${localDate} = (now() at time zone ${timezone})::date`;
  const stockQuantity = warehouseId
    ? sql<number>`coalesce(${warehouseStock.quantity}, 0)`
    : sql<number>`${products.quantity}`;

  let productQuery = db
    .select({
      productCount: sql<number>`count(*) filter (where ${products.isArchived} = false)::int`,
      stockUnits: sql<number>`coalesce(sum(case when ${products.isArchived} = false then ${stockQuantity} else 0 end), 0)::int`,
      outOfStockCount: sql<number>`count(*) filter (where ${products.isArchived} = false and ${stockQuantity} = 0)::int`,
      lowStockCount: sql<number>`count(*) filter (where ${products.isArchived} = false and ${stockQuantity} > 0 and ${stockQuantity} <= ${products.minStock})::int`,
      stockValueCents: sql<string>`coalesce(sum(case when ${products.isArchived} = false then ${stockQuantity} * coalesce(${products.costCents}, ${products.priceCents}) else 0 end), 0)::text`,
    })
    .from(products)
    .$dynamic();

  if (warehouseId) {
    productQuery = productQuery.leftJoin(
      warehouseStock,
      and(
        eq(warehouseStock.productId, products.id),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    );
  }

  let lowStockQuery = db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      quantity: stockQuantity,
      minStock: products.minStock,
    })
    .from(products)
    .$dynamic();

  if (warehouseId) {
    lowStockQuery = lowStockQuery.leftJoin(
      warehouseStock,
      and(
        eq(warehouseStock.productId, products.id),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    );
  }

  const movementConditions = [eq(stockMovements.shopId, shopId)];
  if (warehouseId) {
    movementConditions.push(eq(stockMovements.warehouseId, warehouseId));
  }

  const seriesKeys = lastDateKeys(7, timezone);

  const [
    productRows,
    salesRows,
    seriesRows,
    stockRows,
    recentSalesRows,
    movementRows,
    topRows,
    lowRows,
  ] = await Promise.all([
    productQuery.where(eq(products.shopId, shopId)),

    db
      .select({
        salesTodayCount: sql<number>`count(*) filter (where ${sales.status} = 'completed' and ${isToday})::int`,
        revenueTodayCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.status} = 'completed' and ${isToday}), 0)::text`,
        costTodayCents: sql<string>`coalesce(sum(${sales.costCents}) filter (where ${sales.status} = 'completed' and ${isToday}), 0)::text`,
        monthSalesCount: sql<number>`count(*) filter (where ${sales.status} = 'completed' and ${localDate} >= ${monthStart})::int`,
        monthRevenueCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.status} = 'completed' and ${localDate} >= ${monthStart}), 0)::text`,
        previousMonthSalesCount: sql<number>`count(*) filter (where ${sales.status} = 'completed' and ${localDate} >= ${previousMonthStart} and ${localDate} < ${previousMonthEnd})::int`,
        previousMonthRevenueCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.status} = 'completed' and ${localDate} >= ${previousMonthStart} and ${localDate} < ${previousMonthEnd}), 0)::text`,
      })
      .from(sales)
      .where(and(eq(sales.shopId, shopId), sql`${localDate} >= ${previousMonthStart}`)),

    db
      .select({
        date: sql<string>`to_char(${localDate}, 'YYYY-MM-DD')`,
        revenueCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.status} = 'completed'), 0)::text`,
        count: sql<number>`count(*) filter (where ${sales.status} = 'completed')::int`,
      })
      .from(sales)
      .where(
        and(
          eq(sales.shopId, shopId),
          sql`${localDate} >= (now() at time zone ${timezone})::date - 6`,
        ),
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),

    db
      .select({
        id: warehouses.id,
        name: warehouses.name,
        code: warehouses.code,
        units: sql<number>`coalesce(sum(case when ${products.id} is not null then ${warehouseStock.quantity} else 0 end), 0)::int`,
        valueCents: sql<string>`coalesce(sum(case when ${products.id} is not null then ${warehouseStock.quantity} * coalesce(${products.costCents}, ${products.priceCents}) else 0 end), 0)::text`,
      })
      .from(warehouses)
      .leftJoin(
        warehouseStock,
        and(
          eq(warehouseStock.warehouseId, warehouses.id),
          eq(warehouseStock.shopId, shopId),
        ),
      )
      .leftJoin(
        products,
        and(eq(products.id, warehouseStock.productId), eq(products.isArchived, false)),
      )
      .where(and(eq(warehouses.shopId, shopId), isNull(warehouses.archivedAt)))
      .groupBy(warehouses.id)
      .orderBy(desc(sql`coalesce(sum(case when ${products.id} is not null then ${warehouseStock.quantity} else 0 end), 0)`)),

    db
      .select({
        id: sales.id,
        number: sales.number,
        totalCents: sales.totalCents,
        status: sales.status,
        createdAt: sales.createdAt,
        customerName: customers.name,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .where(eq(sales.shopId, shopId))
      .orderBy(desc(sales.createdAt))
      .limit(5),

    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantityDelta: stockMovements.quantityDelta,
        createdAt: stockMovements.createdAt,
        productName: products.name,
        warehouseName: warehouses.name,
      })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .where(and(...movementConditions))
      .orderBy(desc(stockMovements.createdAt))
      .limit(5),

    db
      .select({
        productId: saleItems.productId,
        name: saleItems.productName,
        quantity: sql<number>`sum(${saleItems.quantity})::int`,
        revenueCents: sql<string>`sum(${saleItems.lineTotalCents})::text`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(eq(sales.shopId, shopId), eq(sales.status, "completed")))
      .groupBy(saleItems.productId, saleItems.productName)
      .orderBy(desc(sql`sum(${saleItems.quantity})`))
      .limit(5),

    lowStockQuery
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.isArchived, false),
          sql`${stockQuantity} <= ${products.minStock}`,
        ),
      )
      .orderBy(sql`${stockQuantity} asc`, products.name)
      .limit(4),
  ]);

  const productStats = productRows[0];
  const salesStats = salesRows[0];
  const seriesByDate = new Map(
    seriesRows.map((row) => [
      row.date,
      { revenueCents: Number(row.revenueCents), count: row.count },
    ]),
  );

  return {
    productCount: productStats?.productCount ?? 0,
    stockUnits: productStats?.stockUnits ?? 0,
    stockValueCents: Number(productStats?.stockValueCents ?? 0),
    outOfStockCount: productStats?.outOfStockCount ?? 0,
    lowStockCount: productStats?.lowStockCount ?? 0,
    salesTodayCount: salesStats?.salesTodayCount ?? 0,
    revenueTodayCents: Number(salesStats?.revenueTodayCents ?? 0),
    costTodayCents: Number(salesStats?.costTodayCents ?? 0),
    monthRevenueCents: Number(salesStats?.monthRevenueCents ?? 0),
    monthSalesCount: salesStats?.monthSalesCount ?? 0,
    previousMonthRevenueCents: Number(salesStats?.previousMonthRevenueCents ?? 0),
    previousMonthSalesCount: salesStats?.previousMonthSalesCount ?? 0,
    salesSeries: seriesKeys.map((date) => ({
      date,
      revenueCents: seriesByDate.get(date)?.revenueCents ?? 0,
      count: seriesByDate.get(date)?.count ?? 0,
    })),
    stockByWarehouse: stockRows.map((row) => ({
      ...row,
      valueCents: Number(row.valueCents),
    })),
    recentSales: recentSalesRows,
    recentMovements: movementRows,
    topProducts: topRows.map((row) => ({
      ...row,
      revenueCents: Number(row.revenueCents),
    })),
    lowStockProducts: lowRows,
  };
}

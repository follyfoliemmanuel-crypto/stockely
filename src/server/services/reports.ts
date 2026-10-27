import { and, asc, desc, eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db";
import {
  categories,
  customers,
  payments,
  products,
  saleItems,
  sales,
  users,
} from "@/server/db/schema";
import { SALE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";

function amount(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function centsToCsv(value: number | null): string {
  if (value === null) return "";
  return (value / 100).toFixed(2).replace(".", ",");
}

function csvCell(value: unknown): string {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ");
  // Neutralise les formules Excel lorsque la valeur est du texte libre.
  if (typeof value === "string" && /^\s*[=+\-@\t]/.test(text)) text = `'${text}`;
  if (/[;"\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(";");
}

/**
 * Agrégats de la période : ventes terminées, panier moyen, marge brute,
 * répartition des paiements, meilleurs produits et état du stock.
 */
export async function getSalesReport(
  shopId: string,
  timezone: string,
  from: string,
  to: string,
) {
  const db = getDb();
  const inRange = and(
    sql`${sales.createdAt} >= (${from}::date at time zone ${timezone})`,
    sql`${sales.createdAt} < ((${to}::date + interval '1 day') at time zone ${timezone})`,
  );
  const completedInRange = and(
    eq(sales.shopId, shopId),
    eq(sales.status, "completed"),
    inRange,
  );

  const [totalsRows, dailyRows, topRows, paymentRows, inventoryRows, lowStock] =
    await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
          revenue: sql<string>`coalesce(sum(${sales.totalCents}), 0)::text`,
          subtotal: sql<string>`coalesce(sum(${sales.subtotalCents}), 0)::text`,
          discount: sql<string>`coalesce(sum(${sales.discountCents}), 0)::text`,
          cost: sql<string>`coalesce(sum(${sales.costCents}), 0)::text`,
        })
        .from(sales)
        .where(completedInRange),
      db
        .select({
          day: sql<string>`to_char((${sales.createdAt} at time zone ${timezone})::date, 'YYYY-MM-DD')`,
          revenue: sql<string>`sum(${sales.totalCents})::text`,
          count: sql<number>`count(*)::int`,
        })
        .from(sales)
        .where(completedInRange)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({
          productId: saleItems.productId,
          productName: saleItems.productName,
          sku: saleItems.sku,
          quantity: sql<number>`sum(${saleItems.quantity})::int`,
          revenue: sql<string>`sum(${saleItems.lineTotalCents})::text`,
          cost: sql<string>`sum(coalesce(${saleItems.unitCostCents}, 0) * ${saleItems.quantity})::text`,
          missingCost: sql<number>`count(*) filter (where ${saleItems.unitCostCents} is null)::int`,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(completedInRange)
        .groupBy(saleItems.productId, saleItems.productName, saleItems.sku)
        .orderBy(desc(sql`sum(${saleItems.lineTotalCents})`))
        .limit(8),
      db
        .select({
          method: payments.method,
          count: sql<number>`count(*)::int`,
          amount: sql<string>`sum(${payments.amountCents})::text`,
        })
        .from(payments)
        .innerJoin(sales, eq(sales.id, payments.saleId))
        .where(completedInRange)
        .groupBy(payments.method)
        .orderBy(desc(sql`sum(${payments.amountCents})`)),
      db
        .select({
          activeProducts: sql<number>`count(*)::int`,
          units: sql<number>`coalesce(sum(${products.quantity}), 0)::int`,
          value: sql<string>`coalesce(sum(${products.quantity} * coalesce(${products.costCents}, ${products.priceCents})), 0)::text`,
          outCount: sql<number>`count(*) filter (where ${products.quantity} = 0)::int`,
          lowCount: sql<number>`count(*) filter (where ${products.quantity} > 0 and ${products.quantity} <= ${products.minStock})::int`,
        })
        .from(products)
        .where(and(eq(products.shopId, shopId), eq(products.isArchived, false))),
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          quantity: products.quantity,
          minStock: products.minStock,
        })
        .from(products)
        .where(
          and(
            eq(products.shopId, shopId),
            eq(products.isArchived, false),
            sql`${products.quantity} <= ${products.minStock}`,
          ),
        )
        .orderBy(asc(products.quantity), asc(products.name))
        .limit(8),
    ]);

  const totals = totalsRows[0];
  const revenue = amount(totals?.revenue);
  const cost = amount(totals?.cost);
  const count = totals?.count ?? 0;
  const inventory = inventoryRows[0];

  return {
    from,
    to,
    totals: {
      count,
      revenue,
      subtotal: amount(totals?.subtotal),
      discount: amount(totals?.discount),
      cost,
      margin: revenue - cost,
      averageBasket: count > 0 ? Math.round(revenue / count) : 0,
    },
    daily: dailyRows.map((row) => ({
      day: row.day,
      revenue: amount(row.revenue),
      count: row.count,
    })),
    topProducts: topRows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      quantity: row.quantity,
      revenue: amount(row.revenue),
      cost: amount(row.cost),
      margin: amount(row.revenue) - amount(row.cost),
      complete: row.missingCost === 0,
    })),
    payments: paymentRows.map((row) => ({
      method: row.method,
      count: row.count,
      amount: amount(row.amount),
    })),
    inventory: {
      activeProducts: inventory?.activeProducts ?? 0,
      units: inventory?.units ?? 0,
      value: amount(inventory?.value),
      outCount: inventory?.outCount ?? 0,
      lowCount: inventory?.lowCount ?? 0,
    },
    lowStock,
  };
}

/**
 * Export CSV des ventes de la période. Les montants sont exprimés en unités
 * majeures avec une virgule décimale, adaptés à Excel en locale française.
 */
export async function buildSalesCsv(
  shopId: string,
  timezone: string,
  from: string,
  to: string,
) {
  const rows = await getDb()
    .select({
      number: sales.number,
      createdAt: sales.createdAt,
      status: sales.status,
      customerName: customers.name,
      cashierName: users.name,
      subtotalCents: sales.subtotalCents,
      discountCents: sales.discountCents,
      totalCents: sales.totalCents,
      costCents: sales.costCents,
      paymentMethod: sql<string | null>`(
        select ${payments.method} from ${payments}
        where ${payments.saleId} = ${sales.id}
        order by ${payments.createdAt} asc limit 1
      )`,
    })
    .from(sales)
    .leftJoin(customers, eq(customers.id, sales.customerId))
    .leftJoin(users, eq(users.id, sales.cashierId))
    .where(
      and(
        eq(sales.shopId, shopId),
        sql`${sales.createdAt} >= (${from}::date at time zone ${timezone})`,
        sql`${sales.createdAt} < ((${to}::date + interval '1 day') at time zone ${timezone})`,
      ),
    )
    .orderBy(desc(sales.createdAt));

  const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: timezone,
  });

  const lines = [
    csvLine([
      "Numéro",
      "Date",
      "Statut",
      "Client",
      "Caissier",
      "Sous-total",
      "Remise",
      "Total",
      "Coût",
      "Marge",
      "Paiement",
    ]),
    ...rows.map((row) =>
      csvLine([
        row.number,
        dateFormatter.format(row.createdAt),
        SALE_STATUS_LABELS[row.status] ?? row.status,
        row.customerName ?? "Client de passage",
        row.cashierName ?? "",
        centsToCsv(row.subtotalCents),
        centsToCsv(row.discountCents),
        centsToCsv(row.totalCents),
        centsToCsv(row.costCents),
        centsToCsv(row.totalCents - row.costCents),
        row.paymentMethod
          ? (PAYMENT_METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod)
          : "",
      ]),
    ),
  ];

  return { csv: lines.join("\r\n"), rowCount: rows.length };
}

/** Export CSV de l'état du stock actif. */
export async function buildInventoryCsv(shopId: string) {
  const rows = await getDb()
    .select({
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      quantity: products.quantity,
      minStock: products.minStock,
      priceCents: products.priceCents,
      costCents: products.costCents,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.shopId, shopId), eq(products.isArchived, false)))
    .orderBy(asc(products.name));

  const lines = [
    csvLine([
      "SKU",
      "Produit",
      "Catégorie",
      "Quantité",
      "Seuil",
      "Prix d'achat",
      "Prix de vente",
      "Valeur du stock",
      "État",
    ]),
    ...rows.map((row) => {
      const valuation =
        row.quantity * (row.costCents ?? row.priceCents);
      const state =
        row.quantity <= 0
          ? "Rupture"
          : row.quantity <= row.minStock
            ? "Stock faible"
            : "Disponible";
      return csvLine([
        row.sku,
        row.name,
        row.categoryName ?? "",
        row.quantity,
        row.minStock,
        centsToCsv(row.costCents),
        centsToCsv(row.priceCents),
        centsToCsv(valuation),
        state,
      ]);
    }),
  ];

  return { csv: lines.join("\r\n"), rowCount: rows.length };
}

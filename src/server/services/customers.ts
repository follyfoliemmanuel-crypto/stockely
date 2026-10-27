import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { customers, sales } from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type { CustomerInput } from "@/server/validation/contacts";

export interface ContactListFilters {
  q?: string;
  page?: number;
  pageSize?: number;
}

const PAGE_SIZE = 20;

export async function listCustomers(
  shopId: string,
  filters: ContactListFilters = {},
) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));
  const conditions = [eq(customers.shopId, shopId)];

  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(
      ilike(customers.name, pattern),
      ilike(customers.phone, pattern),
      ilike(customers.email, pattern),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        notes: customers.notes,
        createdAt: customers.createdAt,
        salesCount: sql<number>`count(${sales.id}) filter (where ${sales.status} = 'completed')::int`,
        spentCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.status} = 'completed'), 0)::text`,
      })
      .from(customers)
      .leftJoin(
        sales,
        and(eq(sales.customerId, customers.id), eq(sales.shopId, shopId)),
      )
      .where(where)
      .groupBy(customers.id)
      .orderBy(asc(customers.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(customers).where(where),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows.map((row) => ({ ...row, spentCents: Number(row.spentCents) })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerStats(shopId: string, timezone: string) {
  const db = getDb();
  const localCreated = sql`(${customers.createdAt} at time zone ${timezone})::date`;
  const monthStart = sql`date_trunc('month', (now() at time zone ${timezone}))::date`;

  const [customerRows, salesRows, topRows] = await Promise.all([
    db
      .select({
        total: count(),
        newThisMonth: sql<number>`count(*) filter (where ${localCreated} >= ${monthStart})::int`,
      })
      .from(customers)
      .where(eq(customers.shopId, shopId)),

    db
      .select({
        active: sql<number>`count(distinct ${sales.customerId})::int`,
        identifiedRevenueCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.customerId} is not null), 0)::text`,
        walkInRevenueCents: sql<string>`coalesce(sum(${sales.totalCents}) filter (where ${sales.customerId} is null), 0)::text`,
        completedSalesCount: sql<number>`count(*)::int`,
      })
      .from(sales)
      .where(and(eq(sales.shopId, shopId), eq(sales.status, "completed"))),

    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        salesCount: sql<number>`count(${sales.id})::int`,
        spentCents: sql<string>`sum(${sales.totalCents})::text`,
        lastSaleAt: sql<Date | null>`max(${sales.createdAt})`,
      })
      .from(customers)
      .innerJoin(
        sales,
        and(
          eq(sales.customerId, customers.id),
          eq(sales.shopId, shopId),
          eq(sales.status, "completed"),
        ),
      )
      .where(eq(customers.shopId, shopId))
      .groupBy(customers.id)
      .orderBy(desc(sql`sum(${sales.totalCents})`))
      .limit(5),
  ]);

  const customerStats = customerRows[0];
  const salesStats = salesRows[0];

  return {
    totalCustomers: Number(customerStats?.total ?? 0),
    newThisMonth: customerStats?.newThisMonth ?? 0,
    activeCustomers: salesStats?.active ?? 0,
    identifiedRevenueCents: Number(salesStats?.identifiedRevenueCents ?? 0),
    walkInRevenueCents: Number(salesStats?.walkInRevenueCents ?? 0),
    completedSalesCount: salesStats?.completedSalesCount ?? 0,
    topCustomers: topRows.map((row) => ({
      ...row,
      spentCents: Number(row.spentCents),
    })),
  };
}

export async function listCustomerOptions(shopId: string, q = "") {
  const conditions = [eq(customers.shopId, shopId)];
  if (q.trim()) {
    const pattern = `%${q.trim().slice(0, 100)}%`;
    const search = or(
      ilike(customers.name, pattern),
      ilike(customers.phone, pattern),
    );
    if (search) conditions.push(search);
  }

  return getDb()
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
    })
    .from(customers)
    .where(and(...conditions))
    .orderBy(asc(customers.name))
    .limit(50);
}

export async function getCustomer(shopId: string, customerId: string) {
  if (!isUuid(customerId)) return null;

  const rows = await getDb()
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.shopId, shopId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCustomerWithSales(shopId: string, customerId: string) {
  const customer = await getCustomer(shopId, customerId);
  if (!customer) return null;

  const history = await getDb()
    .select({
      id: sales.id,
      number: sales.number,
      totalCents: sales.totalCents,
      status: sales.status,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .where(and(eq(sales.shopId, shopId), eq(sales.customerId, customerId)))
    .orderBy(desc(sales.createdAt))
    .limit(20);

  return { customer, history };
}

export async function createCustomer(
  context: AuthContext,
  input: CustomerInput,
): Promise<{ id: string }> {
  return getDb().transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ shopId: context.shop.id, ...input })
      .returning({ id: customers.id });

    if (!customer) throw new Error("Création du client impossible");

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "customer.created",
      entityType: "customer",
      entityId: customer.id,
      metadata: { name: input.name },
    });

    return { id: customer.id };
  });
}

export async function updateCustomer(
  context: AuthContext,
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const existing = await getCustomer(context.shop.id, customerId);
  if (!existing) throw new ApiError(404, "customer_not_found", "Client introuvable.");

  await getDb().transaction(async (tx) => {
    await tx
      .update(customers)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(customers.id, customerId), eq(customers.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "customer.updated",
      entityType: "customer",
      entityId: customerId,
      metadata: { name: input.name },
    });
  });
}

export async function deleteCustomer(
  context: AuthContext,
  customerId: string,
): Promise<void> {
  const existing = await getCustomer(context.shop.id, customerId);
  if (!existing) throw new ApiError(404, "customer_not_found", "Client introuvable.");

  await getDb().transaction(async (tx) => {
    await tx
      .delete(customers)
      .where(and(eq(customers.id, customerId), eq(customers.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "customer.deleted",
      entityType: "customer",
      entityId: customerId,
      metadata: { name: existing.name },
    });
  });
}

import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { isValidIsoDate } from "@/lib/date";
import { getDb } from "@/server/db";
import { auditLogs, users } from "@/server/db/schema";

const PAGE_SIZE = 30;

export interface AuditListFilters {
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(
  shopId: string,
  filters: AuditListFilters = {},
  timezone = "UTC",
) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));
  const conditions = [eq(auditLogs.shopId, shopId)];

  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(
      ilike(auditLogs.action, pattern),
      ilike(auditLogs.entityType, pattern),
      ilike(auditLogs.entityId, pattern),
      ilike(users.name, pattern),
      ilike(users.email, pattern),
    );
    if (search) conditions.push(search);
  }
  if (filters.from && isValidIsoDate(filters.from)) {
    conditions.push(
      sql`${auditLogs.createdAt} >= (${filters.from}::date at time zone ${timezone})`,
    );
  }
  if (filters.to && isValidIsoDate(filters.to)) {
    conditions.push(
      sql`${auditLogs.createdAt} < ((${filters.to}::date + interval '1 day') at time zone ${timezone})`,
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where)
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.userId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return {
    items: rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAuditStats(shopId: string, timezone: string) {
  const isToday = sql`(${auditLogs.createdAt} at time zone ${timezone})::date = (now() at time zone ${timezone})::date`;
  const rows = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      today: sql<number>`count(*) filter (where ${isToday})::int`,
      cancelledSales: sql<number>`count(*) filter (where ${auditLogs.action} = 'sale.cancelled')::int`,
      stockEvents: sql<number>`count(*) filter (where ${auditLogs.action} like 'stock.%')::int`,
      lastAt: sql<string | null>`max(${auditLogs.createdAt})::text`,
    })
    .from(auditLogs)
    .where(eq(auditLogs.shopId, shopId));

  const row = rows[0];
  return {
    total: row?.total ?? 0,
    today: row?.today ?? 0,
    cancelledSales: row?.cancelledSales ?? 0,
    stockEvents: row?.stockEvents ?? 0,
    lastAt: row?.lastAt ?? null,
  };
}

import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { products, suppliers } from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type { SupplierInput } from "@/server/validation/contacts";
import type { ContactListFilters } from "./customers";

const PAGE_SIZE = 20;

export async function listSuppliers(
  shopId: string,
  filters: ContactListFilters = {},
) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));
  const conditions = [eq(suppliers.shopId, shopId)];

  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    const search = or(
      ilike(suppliers.name, pattern),
      ilike(suppliers.phone, pattern),
      ilike(suppliers.email, pattern),
    );
    if (search) conditions.push(search);
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        phone: suppliers.phone,
        email: suppliers.email,
        address: suppliers.address,
        notes: suppliers.notes,
        createdAt: suppliers.createdAt,
        productCount: sql<number>`count(${products.id}) filter (where ${products.isArchived} = false)::int`,
      })
      .from(suppliers)
      .leftJoin(
        products,
        and(eq(products.supplierId, suppliers.id), eq(products.shopId, shopId)),
      )
      .where(where)
      .groupBy(suppliers.id)
      .orderBy(asc(suppliers.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(suppliers).where(where),
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

export async function listSupplierOptions(shopId: string) {
  return getDb()
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(and(eq(suppliers.shopId, shopId), eq(suppliers.isActive, true)))
    .orderBy(asc(suppliers.name));
}

export async function getSupplier(shopId: string, supplierId: string) {
  if (!isUuid(supplierId)) return null;

  const rows = await getDb()
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, shopId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createSupplier(
  context: AuthContext,
  input: SupplierInput,
): Promise<{ id: string }> {
  return getDb().transaction(async (tx) => {
    const [supplier] = await tx
      .insert(suppliers)
      .values({ shopId: context.shop.id, ...input })
      .returning({ id: suppliers.id });

    if (!supplier) throw new Error("Création du fournisseur impossible");

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "supplier.created",
      entityType: "supplier",
      entityId: supplier.id,
      metadata: { name: input.name },
    });

    return { id: supplier.id };
  });
}

export async function updateSupplier(
  context: AuthContext,
  supplierId: string,
  input: SupplierInput,
): Promise<void> {
  const existing = await getSupplier(context.shop.id, supplierId);
  if (!existing) {
    throw new ApiError(404, "supplier_not_found", "Fournisseur introuvable.");
  }

  await getDb().transaction(async (tx) => {
    await tx
      .update(suppliers)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "supplier.updated",
      entityType: "supplier",
      entityId: supplierId,
      metadata: { name: input.name },
    });
  });
}

export async function deleteSupplier(
  context: AuthContext,
  supplierId: string,
): Promise<void> {
  const existing = await getSupplier(context.shop.id, supplierId);
  if (!existing) {
    throw new ApiError(404, "supplier_not_found", "Fournisseur introuvable.");
  }

  await getDb().transaction(async (tx) => {
    await tx
      .delete(suppliers)
      .where(and(eq(suppliers.id, supplierId), eq(suppliers.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "supplier.deleted",
      entityType: "supplier",
      entityId: supplierId,
      metadata: { name: existing.name },
    });
  });
}

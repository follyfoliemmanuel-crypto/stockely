import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb, type Database } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import {
  memberships,
  products,
  users,
  warehouseAccess,
  warehouseStock,
  warehouses,
  type MemberRole,
  type Warehouse,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type {
  WarehouseAccessInput,
  WarehouseCreateInput,
  WarehouseUpdateInput,
} from "@/server/validation/warehouses";

/** Cookie httpOnly contenant l'entrepôt de travail choisi. */
export const WAREHOUSE_COOKIE = "stockely_warehouse";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Rôles de pilotage : ils accèdent à tous les entrepôts sans autorisation
 * explicite. Les autres rôles ne voient que les entrepôts qui leur sont
 * attribués (ou l'entrepôt par défaut s'ils n'ont aucune attribution).
 */
const ALL_WAREHOUSES_ROLES: ReadonlySet<MemberRole> = new Set<MemberRole>([
  "owner",
  "admin",
  "stock_manager",
  "accountant",
]);

export function hasAllWarehouseAccess(role: MemberRole): boolean {
  return ALL_WAREHOUSES_ROLES.has(role);
}

export async function listWarehouses(shopId: string): Promise<Warehouse[]> {
  return getDb()
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.shopId, shopId), isNull(warehouses.archivedAt)))
    .orderBy(desc(warehouses.isDefault), asc(warehouses.name));
}

export async function getWarehouse(
  shopId: string,
  warehouseId: string,
): Promise<Warehouse | null> {
  if (!isUuid(warehouseId)) return null;
  const rows = await getDb()
    .select()
    .from(warehouses)
    .where(
      and(
        eq(warehouses.id, warehouseId),
        eq(warehouses.shopId, shopId),
        isNull(warehouses.archivedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Lecture historique : un entrepôt archivé reste résolvable pour ses ventes. */
export async function getWarehouseIncludingArchived(
  shopId: string,
  warehouseId: string,
): Promise<Warehouse | null> {
  if (!isUuid(warehouseId)) return null;
  const rows = await getDb()
    .select()
    .from(warehouses)
    .where(and(eq(warehouses.id, warehouseId), eq(warehouses.shopId, shopId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Entrepôts réellement accessibles au membre connecté.
 * L'identifiant fourni par le client n'est jamais accepté sans cette
 * vérification : il est toujours confronté à l'appartenance en base.
 */
export async function listAccessibleWarehouses(
  context: Pick<AuthContext, "shop" | "membership" | "role">,
): Promise<Warehouse[]> {
  const all = await listWarehouses(context.shop.id);
  if (all.length === 0) return [];
  if (hasAllWarehouseAccess(context.role)) return all;

  const assigned = await getDb()
    .select({ warehouseId: warehouseAccess.warehouseId })
    .from(warehouseAccess)
    .where(
      and(
        eq(warehouseAccess.shopId, context.shop.id),
        eq(warehouseAccess.membershipId, context.membership.id),
      ),
    );

  if (assigned.length === 0) {
    const fallback = all.find((warehouse) => warehouse.isDefault) ?? all[0];
    return fallback ? [fallback] : [];
  }

  const allowed = new Set(assigned.map((row) => row.warehouseId));
  return all.filter((warehouse) => allowed.has(warehouse.id));
}

/**
 * Résout l'entrepôt de travail :
 * 1. l'identifiant demandé, s'il est accessible ;
 * 2. sinon l'entrepôt par défaut accessible ;
 * 3. sinon le premier entrepôt accessible.
 */
export async function resolveWarehouse(
  context: Pick<AuthContext, "shop" | "membership" | "role">,
  requestedId?: string | null,
): Promise<Warehouse> {
  const accessible = await listAccessibleWarehouses(context);

  if (requestedId) {
    const requested = accessible.find((warehouse) => warehouse.id === requestedId);
    if (!requested) {
      throw new ApiError(404, "warehouse_not_found", "Entrepôt introuvable.");
    }
    return requested;
  }

  const chosen =
    accessible.find((warehouse) => warehouse.isDefault) ?? accessible[0];
  if (!chosen) {
    throw new ApiError(
      409,
      "warehouse_required",
      "Aucun entrepôt actif n'est disponible pour cette boutique.",
    );
  }
  return chosen;
}

/* -------------------------------------------------------------------------- */
/* Mutations du stock par entrepôt                                            */
/* -------------------------------------------------------------------------- */

/**
 * Garantit l'existence de la ligne de stock (quantité 0) pour un couple
 * entrepôt/produit. À appeler dans une transaction où le produit est verrouillé.
 */
export async function ensureWarehouseStockRow(
  tx: Transaction,
  input: { shopId: string; warehouseId: string; productId: string },
): Promise<void> {
  await tx
    .insert(warehouseStock)
    .values({
      shopId: input.shopId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      quantity: 0,
    })
    .onConflictDoNothing({
      target: [warehouseStock.warehouseId, warehouseStock.productId],
    });
}

/** Quantité actuelle dans un entrepôt (0 si la ligne n'existe pas encore). */
export async function getWarehouseQuantity(
  tx: Transaction,
  warehouseId: string,
  productId: string,
): Promise<number> {
  const rows = await tx
    .select({ quantity: warehouseStock.quantity })
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.warehouseId, warehouseId),
        eq(warehouseStock.productId, productId),
      ),
    )
    .limit(1);
  return rows[0]?.quantity ?? 0;
}

/**
 * Applique un delta signé au stock d'un entrepôt et renvoie la nouvelle
 * quantité. Refuse tout résultat négatif au niveau base (garde-fou + CHECK).
 * Le verrou produit pris par l'appelant sérialise les écritures concurrentes.
 */
export async function applyWarehouseDelta(
  tx: Transaction,
  input: {
    shopId: string;
    warehouseId: string;
    productId: string;
    delta: number;
    productName?: string;
  },
): Promise<number> {
  await ensureWarehouseStockRow(tx, input);

  const rows = await tx
    .update(warehouseStock)
    .set({
      quantity: sql`${warehouseStock.quantity} + ${input.delta}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(warehouseStock.warehouseId, input.warehouseId),
        eq(warehouseStock.productId, input.productId),
        sql`${warehouseStock.quantity} + ${input.delta} >= 0`,
      ),
    )
    .returning({ quantity: warehouseStock.quantity });

  const updated = rows[0];
  if (!updated) {
    throw new ApiError(
      422,
      "insufficient_stock",
      input.productName
        ? `Stock insuffisant pour « ${input.productName} » dans cet entrepôt.`
        : "Stock insuffisant dans cet entrepôt.",
    );
  }
  return updated.quantity;
}

/**
 * Met à jour le cache dénormalisé `products.quantity` (total tous entrepôts).
 * La source de vérité reste `warehouse_stock`.
 */
export async function applyProductTotalDelta(
  tx: Transaction,
  input: { shopId: string; productId: string; delta: number },
): Promise<void> {
  const rows = await tx
    .update(products)
    .set({
      quantity: sql`${products.quantity} + ${input.delta}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.shopId, input.shopId),
        sql`${products.quantity} + ${input.delta} >= 0`,
      ),
    )
    .returning({ id: products.id });

  if (!rows[0]) {
    throw new ApiError(
      409,
      "stock_cache_conflict",
      "Le stock total du produit est incohérent. Contactez un administrateur.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Gestion des entrepôts                                                      */
/* -------------------------------------------------------------------------- */

export interface WarehouseOverview extends Warehouse {
  skuCount: number;
  quantity: number;
}

export async function listWarehouseOverview(shopId: string): Promise<WarehouseOverview[]> {
  const rows = await getDb()
    .select({
      warehouse: warehouses,
      skuCount: sql<number>`count(*) filter (where ${warehouseStock.quantity} > 0)::int`,
      quantity: sql<number>`coalesce(sum(${warehouseStock.quantity}), 0)::int`,
    })
    .from(warehouses)
    .leftJoin(warehouseStock, eq(warehouseStock.warehouseId, warehouses.id))
    .where(and(eq(warehouses.shopId, shopId), isNull(warehouses.archivedAt)))
    .groupBy(warehouses.id)
    .orderBy(desc(warehouses.isDefault), asc(warehouses.name));

  return rows.map((row) => ({
    ...row.warehouse,
    skuCount: row.skuCount,
    quantity: row.quantity,
  }));
}

async function assertCodeAvailable(
  shopId: string,
  code: string,
  exceptId?: string,
): Promise<void> {
  const conditions = [
    eq(warehouses.shopId, shopId),
    sql`upper(${warehouses.code}) = ${code.toUpperCase()}`,
  ];
  if (exceptId) conditions.push(ne(warehouses.id, exceptId));

  const rows = await getDb()
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(and(...conditions))
    .limit(1);

  if (rows[0]) {
    throw new ApiError(
      409,
      "warehouse_code_taken",
      "Un entrepôt utilise déjà ce code dans cette boutique.",
    );
  }
}

export async function createWarehouse(
  context: AuthContext,
  input: WarehouseCreateInput,
): Promise<{ id: string }> {
  await assertCodeAvailable(context.shop.id, input.code);

  try {
    return await getDb().transaction(async (tx) => {
      const existing = await tx
        .select({ total: count() })
        .from(warehouses)
        .where(
          and(eq(warehouses.shopId, context.shop.id), isNull(warehouses.archivedAt)),
        );

      const isFirst = Number(existing[0]?.total ?? 0) === 0;
      const isDefault = isFirst || input.isDefault;

      if (isDefault) {
        await tx
          .update(warehouses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(eq(warehouses.shopId, context.shop.id), eq(warehouses.isDefault, true)),
          );
      }

      const [warehouse] = await tx
        .insert(warehouses)
        .values({
          shopId: context.shop.id,
          name: input.name,
          code: input.code,
          address: input.address,
          isDefault,
          isActive: true,
        })
        .returning({ id: warehouses.id });

      if (!warehouse) throw new Error("Création de l'entrepôt impossible");

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "warehouse.created",
        entityType: "warehouse",
        entityId: warehouse.id,
        metadata: { name: input.name, code: input.code, isDefault },
      });

      return { id: warehouse.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        409,
        "warehouse_code_taken",
        "Un entrepôt utilise déjà ce code dans cette boutique.",
      );
    }
    throw error;
  }
}

export async function updateWarehouse(
  context: AuthContext,
  warehouseId: string,
  input: WarehouseUpdateInput,
): Promise<void> {
  const existing = await getWarehouse(context.shop.id, warehouseId);
  if (!existing) {
    throw new ApiError(404, "warehouse_not_found", "Entrepôt introuvable.");
  }
  if (existing.isDefault && input.isDefault === false) {
    throw new ApiError(
      409,
      "default_warehouse_required",
      "Désignez d'abord un autre entrepôt par défaut avant de retirer ce statut.",
    );
  }
  if (existing.code !== input.code) {
    await assertCodeAvailable(context.shop.id, input.code, warehouseId);
  }

  try {
    await getDb().transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(warehouses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(warehouses.shopId, context.shop.id),
              eq(warehouses.isDefault, true),
              ne(warehouses.id, warehouseId),
            ),
          );
      }

      await tx
        .update(warehouses)
        .set({
          name: input.name,
          code: input.code,
          address: input.address,
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(warehouses.id, warehouseId),
            eq(warehouses.shopId, context.shop.id),
          ),
        );

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "warehouse.updated",
        entityType: "warehouse",
        entityId: warehouseId,
        metadata: { name: input.name, code: input.code, isDefault: input.isDefault },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        409,
        "warehouse_code_taken",
        "Un entrepôt utilise déjà ce code dans cette boutique.",
      );
    }
    throw error;
  }
}

export async function setWarehouseArchived(
  context: AuthContext,
  warehouseId: string,
  archived: boolean,
): Promise<void> {
  const existing = await getWarehouse(context.shop.id, warehouseId);
  if (!existing) {
    throw new ApiError(404, "warehouse_not_found", "Entrepôt introuvable.");
  }

  await getDb().transaction(async (tx) => {
    if (archived) {
      const stockRows = await tx
        .select({ quantity: sql<number>`coalesce(sum(${warehouseStock.quantity}), 0)::int` })
        .from(warehouseStock)
        .where(eq(warehouseStock.warehouseId, warehouseId));

      if (Number(stockRows[0]?.quantity ?? 0) > 0) {
        throw new ApiError(
          409,
          "warehouse_not_empty",
          "Impossible d'archiver un entrepôt qui contient encore du stock.",
        );
      }

      const activeRows = await tx
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.shopId, context.shop.id),
            eq(warehouses.isActive, true),
            isNull(warehouses.archivedAt),
            ne(warehouses.id, warehouseId),
          ),
        )
        .limit(1);

      if (!activeRows[0]) {
        throw new ApiError(
          409,
          "last_warehouse",
          "Impossible d'archiver le dernier entrepôt actif de la boutique.",
        );
      }

      if (existing.isDefault) {
        // La contrainte d'unicité n'autorise qu'un seul entrepôt par défaut :
        // on retire donc le statut courant avant de le transférer.
        await tx
          .update(warehouses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(warehouses.shopId, context.shop.id),
              eq(warehouses.isDefault, true),
            ),
          );
        await tx
          .update(warehouses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(warehouses.id, activeRows[0].id));
      }
    }

    await tx
      .update(warehouses)
      .set({
        isActive: !archived,
        archivedAt: archived ? new Date() : null,
        isDefault: archived ? false : existing.isDefault,
        updatedAt: new Date(),
      })
      .where(
        and(eq(warehouses.id, warehouseId), eq(warehouses.shopId, context.shop.id)),
      );

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: archived ? "warehouse.archived" : "warehouse.restored",
      entityType: "warehouse",
      entityId: warehouseId,
      metadata: { name: existing.name, code: existing.code },
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Accès par membre                                                           */
/* -------------------------------------------------------------------------- */

export interface WarehouseMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  hasAccess: boolean;
}

export async function listWarehouseMembers(
  shopId: string,
  warehouseId: string,
): Promise<WarehouseMember[]> {
  const rows = await getDb()
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      accessId: warehouseAccess.id,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .leftJoin(
      warehouseAccess,
      and(
        eq(warehouseAccess.membershipId, memberships.id),
        eq(warehouseAccess.warehouseId, warehouseId),
      ),
    )
    .where(eq(memberships.shopId, shopId))
    .orderBy(asc(users.name));

  return rows.map((row) => ({
    membershipId: row.membershipId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    hasAccess: Boolean(row.accessId),
  }));
}

export async function setWarehouseAccess(
  context: AuthContext,
  warehouseId: string,
  input: WarehouseAccessInput,
): Promise<void> {
  const warehouse = await getWarehouse(context.shop.id, warehouseId);
  if (!warehouse) {
    throw new ApiError(404, "warehouse_not_found", "Entrepôt introuvable.");
  }

  const uniqueIds = [...new Set(input.membershipIds)];
  if (uniqueIds.length > 0) {
    const valid = await getDb()
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.shopId, context.shop.id),
          inArray(memberships.id, uniqueIds),
        ),
      );
    if (valid.length !== uniqueIds.length) {
      throw new ApiError(
        422,
        "invalid_membership",
        "Un membre sélectionné n'appartient pas à cette boutique.",
      );
    }
  }

  await getDb().transaction(async (tx) => {
    await tx
      .delete(warehouseAccess)
      .where(
        and(
          eq(warehouseAccess.shopId, context.shop.id),
          eq(warehouseAccess.warehouseId, warehouseId),
        ),
      );

    if (uniqueIds.length > 0) {
      await tx.insert(warehouseAccess).values(
        uniqueIds.map((membershipId) => ({
          shopId: context.shop.id,
          warehouseId,
          membershipId,
        })),
      );
    }

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "warehouse.access_updated",
      entityType: "warehouse",
      entityId: warehouseId,
      metadata: { memberCount: uniqueIds.length },
    });
  });
}

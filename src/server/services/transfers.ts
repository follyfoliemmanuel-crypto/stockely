import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb, type Database } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import {
  products,
  stockMovements,
  transferCounters,
  users,
  warehouseTransferItems,
  warehouseTransfers,
  warehouses,
  type TransferStatus,
  type WarehouseTransfer,
  type WarehouseTransferItem,
} from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type {
  TransferCancelInput,
  TransferCreateInput,
  TransferReceiveInput,
  TransferShipInput,
} from "@/server/validation/transfers";
import {
  applyProductTotalDelta,
  applyWarehouseDelta,
  ensureWarehouseStockRow,
  getWarehouse,
  resolveWarehouse,
} from "@/server/services/warehouses";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const PAGE_SIZE = 25;

export interface TransferListFilters {
  status?: TransferStatus;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  warehouseId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface TransferListItem {
  id: string;
  number: string;
  status: TransferStatus;
  note: string | null;
  fromWarehouseId: string;
  fromWarehouseName: string;
  fromWarehouseCode: string;
  toWarehouseId: string;
  toWarehouseName: string;
  toWarehouseCode: string;
  itemCount: number;
  totalQuantitySent: number;
  totalQuantityReceived: number | null;
  createdByName: string | null;
  createdAt: Date;
  shippedAt: Date | null;
  receivedAt: Date | null;
  cancelledAt: Date | null;
}

export async function listTransfers(
  shopId: string,
  filters: TransferListFilters = {},
) {
  const db = getDb();
  const page = Math.min(10_000, Math.max(1, filters.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? PAGE_SIZE));

  const conditions = [eq(warehouseTransfers.shopId, shopId)];

  if (filters.status) {
    conditions.push(eq(warehouseTransfers.status, filters.status));
  }
  if (filters.fromWarehouseId && isUuid(filters.fromWarehouseId)) {
    conditions.push(eq(warehouseTransfers.fromWarehouseId, filters.fromWarehouseId));
  }
  if (filters.toWarehouseId && isUuid(filters.toWarehouseId)) {
    conditions.push(eq(warehouseTransfers.toWarehouseId, filters.toWarehouseId));
  }
  if (filters.warehouseId && isUuid(filters.warehouseId)) {
    conditions.push(
      sql`(${warehouseTransfers.fromWarehouseId} = ${filters.warehouseId} or ${warehouseTransfers.toWarehouseId} = ${filters.warehouseId})`,
    );
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim().slice(0, 100)}%`;
    conditions.push(sql`${warehouseTransfers.number} ilike ${pattern}`);
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: warehouseTransfers.id,
        number: warehouseTransfers.number,
        status: warehouseTransfers.status,
        note: warehouseTransfers.note,
        fromWarehouseId: warehouseTransfers.fromWarehouseId,
        fromWarehouseName: sql<string>`w_from.name`,
        fromWarehouseCode: sql<string>`w_from.code`,
        toWarehouseId: warehouseTransfers.toWarehouseId,
        toWarehouseName: sql<string>`w_to.name`,
        toWarehouseCode: sql<string>`w_to.code`,
        itemCount: sql<number>`count(distinct ${warehouseTransferItems.id})::int`,
        totalQuantitySent: sql<number>`coalesce(sum(${warehouseTransferItems.quantitySent}), 0)::int`,
        totalQuantityReceived: sql<number | null>`sum(${warehouseTransferItems.quantityReceived})::int`,
        createdByName: users.name,
        createdAt: warehouseTransfers.createdAt,
        shippedAt: warehouseTransfers.shippedAt,
        receivedAt: warehouseTransfers.receivedAt,
        cancelledAt: warehouseTransfers.cancelledAt,
      })
      .from(warehouseTransfers)
      .innerJoin(
        sql`${warehouses} as w_from`,
        sql`w_from.id = ${warehouseTransfers.fromWarehouseId}`,
      )
      .innerJoin(
        sql`${warehouses} as w_to`,
        sql`w_to.id = ${warehouseTransfers.toWarehouseId}`,
      )
      .leftJoin(
        warehouseTransferItems,
        eq(warehouseTransferItems.transferId, warehouseTransfers.id),
      )
      .leftJoin(users, eq(users.id, warehouseTransfers.createdBy))
      .where(where)
      .groupBy(
        warehouseTransfers.id,
        sql`w_from.name`,
        sql`w_from.code`,
        sql`w_to.name`,
        sql`w_to.code`,
        users.name,
      )
      .orderBy(desc(warehouseTransfers.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(warehouseTransfers)
      .where(where),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);

  return {
    items: rows as TransferListItem[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type TransferDetail = Omit<
  WarehouseTransfer,
  "createdBy" | "shippedBy" | "receivedBy" | "cancelledBy"
> & {
  fromWarehouse: { id: string; name: string; code: string };
  toWarehouse: { id: string; name: string; code: string };
  items: WarehouseTransferItem[];
  createdBy: { id: string; name: string } | null;
  shippedBy: { id: string; name: string } | null;
  receivedBy: { id: string; name: string } | null;
  cancelledBy: { id: string; name: string } | null;
};

export async function getTransfer(
  shopId: string,
  transferId: string,
): Promise<TransferDetail | null> {
  if (!isUuid(transferId)) return null;

  const db = getDb();

  const [transferRows, items] = await Promise.all([
    db
      .select({
        transfer: warehouseTransfers,
        fromName: sql<string>`w_from.name`,
        fromCode: sql<string>`w_from.code`,
        toName: sql<string>`w_to.name`,
        toCode: sql<string>`w_to.code`,
        createdByName: sql<string | null>`u_created.name`,
        shippedByName: sql<string | null>`u_shipped.name`,
        receivedByName: sql<string | null>`u_received.name`,
        cancelledByName: sql<string | null>`u_cancelled.name`,
      })
      .from(warehouseTransfers)
      .innerJoin(
        sql`${warehouses} as w_from`,
        sql`w_from.id = ${warehouseTransfers.fromWarehouseId}`,
      )
      .innerJoin(
        sql`${warehouses} as w_to`,
        sql`w_to.id = ${warehouseTransfers.toWarehouseId}`,
      )
      .leftJoin(sql`${users} as u_created`, sql`u_created.id = ${warehouseTransfers.createdBy}`)
      .leftJoin(sql`${users} as u_shipped`, sql`u_shipped.id = ${warehouseTransfers.shippedBy}`)
      .leftJoin(sql`${users} as u_received`, sql`u_received.id = ${warehouseTransfers.receivedBy}`)
      .leftJoin(sql`${users} as u_cancelled`, sql`u_cancelled.id = ${warehouseTransfers.cancelledBy}`)
      .where(
        and(
          eq(warehouseTransfers.id, transferId),
          eq(warehouseTransfers.shopId, shopId),
        ),
      )
      .limit(1),
    db
      .select()
      .from(warehouseTransferItems)
      .where(eq(warehouseTransferItems.transferId, transferId))
      .orderBy(asc(warehouseTransferItems.productName)),
  ]);

  const row = transferRows[0];
  if (!row) return null;

  return {
    ...row.transfer,
    fromWarehouse: {
      id: row.transfer.fromWarehouseId,
      name: row.fromName,
      code: row.fromCode,
    },
    toWarehouse: {
      id: row.transfer.toWarehouseId,
      name: row.toName,
      code: row.toCode,
    },
    items,
    createdBy: row.transfer.createdBy
      ? { id: row.transfer.createdBy, name: row.createdByName ?? "" }
      : null,
    shippedBy: row.transfer.shippedBy
      ? { id: row.transfer.shippedBy, name: row.shippedByName ?? "" }
      : null,
    receivedBy: row.transfer.receivedBy
      ? { id: row.transfer.receivedBy, name: row.receivedByName ?? "" }
      : null,
    cancelledBy: row.transfer.cancelledBy
      ? { id: row.transfer.cancelledBy, name: row.cancelledByName ?? "" }
      : null,
  };
}

/**
 * Alloue le prochain numéro de transfert pour la boutique de manière atomique.
 */
async function nextTransferNumber(tx: Transaction, shopId: string): Promise<string> {
  const result = await tx
    .insert(transferCounters)
    .values({ shopId, lastNumber: 1 })
    .onConflictDoUpdate({
      target: transferCounters.shopId,
      set: { lastNumber: sql`${transferCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: transferCounters.lastNumber });

  const num = result[0]?.lastNumber ?? 1;
  return `TRF-${String(num).padStart(5, "0")}`;
}

/**
 * Crée et prépare un transfert de marchandises entre deux entrepôts.
 * Le stock est décrémenté immédiatement de l'entrepôt source (`transfer_out`).
 * Le total global de l'entreprise `products.quantity` reste inchangé car
 * la marchandise est toujours détenue par l'entreprise en cours de transit.
 */
export async function createTransfer(
  context: AuthContext,
  input: TransferCreateInput,
): Promise<{ transferId: string; number: string }> {
  const db = getDb();
  const shopId = context.shop.id;

  // Idempotence : si la clé existe déjà, retourner le transfert créé
  if (input.idempotencyKey) {
    const existing = await db
      .select({ id: warehouseTransfers.id, number: warehouseTransfers.number })
      .from(warehouseTransfers)
      .where(
        and(
          eq(warehouseTransfers.shopId, shopId),
          eq(warehouseTransfers.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { transferId: existing[0].id, number: existing[0].number };
    }
  }

  // Vérifier l'accès et l'existence des entrepôts
  const [fromWarehouse, toWarehouse] = await Promise.all([
    getWarehouse(shopId, input.fromWarehouseId),
    getWarehouse(shopId, input.toWarehouseId),
  ]);

  if (!fromWarehouse || !fromWarehouse.isActive) {
    throw new ApiError(
      404,
      "from_warehouse_not_found",
      "L'entrepôt d'origine est introuvable ou inactif.",
    );
  }
  if (!toWarehouse || !toWarehouse.isActive) {
    throw new ApiError(
      404,
      "to_warehouse_not_found",
      "L'entrepôt de destination est introuvable ou inactif.",
    );
  }

  // Vérifier que le membre a accès à l'entrepôt source
  await resolveWarehouse(context, fromWarehouse.id);

  try {
    return await db.transaction(async (tx) => {
      // 1. Verrouiller les produits concernés
      const productIds = input.items.map((i) => i.productId);
      const lockedProducts = await tx
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
        })
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            eq(products.shopId, shopId),
            eq(products.isArchived, false),
          ),
        )
        .for("update");

      if (lockedProducts.length !== productIds.length) {
        throw new ApiError(
          404,
          "products_missing",
          "Un ou plusieurs produits à transférer sont introuvables ou archivés.",
        );
      }

      const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

      // 2. Allouer le numéro de transfert
      const transferNumber = await nextTransferNumber(tx, shopId);

      // 3. Insérer le transfert
      const inserted = await tx
        .insert(warehouseTransfers)
        .values({
          shopId,
          number: transferNumber,
          fromWarehouseId: fromWarehouse.id,
          toWarehouseId: toWarehouse.id,
          status: "prepared",
          note: input.note,
          idempotencyKey: input.idempotencyKey ?? null,
          createdBy: context.user.id,
        })
        .returning({ id: warehouseTransfers.id, number: warehouseTransfers.number });

      const transfer = inserted[0];
      if (!transfer) {
        throw new ApiError(500, "transfer_failed", "Échec de création du transfert.");
      }

      // 4. Traiter chaque article : décrémenter de l'entrepôt source et tracer le mouvement
      for (const item of input.items) {
        const prod = productMap.get(item.productId)!;

        // Assurer que la ligne de stock existe
        await ensureWarehouseStockRow(tx, {
          shopId,
          warehouseId: fromWarehouse.id,
          productId: prod.id,
        });

        // Décrémente le stock source (échoue avec 422 si stock insuffisant)
        await applyWarehouseDelta(tx, {
          shopId,
          warehouseId: fromWarehouse.id,
          productId: prod.id,
          delta: -item.quantity,
          productName: prod.name,
        });

        // Insère la ligne de transfert
        await tx.insert(warehouseTransferItems).values({
          transferId: transfer.id,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantitySent: item.quantity,
        });

        // Mouvement de sortie de l'entrepôt source rattaché au transfert
        await tx.insert(stockMovements).values({
          shopId,
          productId: prod.id,
          warehouseId: fromWarehouse.id,
          userId: context.user.id,
          transferId: transfer.id,
          type: "transfer_out",
          quantityDelta: -item.quantity,
          reason: `Transfert ${transferNumber} vers ${toWarehouse.name}`,
        });
      }

      // 5. Journal d'audit
      await writeAudit(tx as never, {
        shopId,
        userId: context.user.id,
        action: "transfer.create",
        entityType: "warehouse_transfer",
        entityId: transfer.id,
        metadata: {
          number: transfer.number,
          fromWarehouseId: fromWarehouse.id,
          toWarehouseId: toWarehouse.id,
          itemCount: input.items.length,
        },
      });

      return { transferId: transfer.id, number: transfer.number };
    });
  } catch (error) {
    if (isUniqueViolation(error) && input.idempotencyKey) {
      const existing = await db
        .select({ id: warehouseTransfers.id, number: warehouseTransfers.number })
        .from(warehouseTransfers)
        .where(
          and(
            eq(warehouseTransfers.shopId, shopId),
            eq(warehouseTransfers.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing[0]) {
        return { transferId: existing[0].id, number: existing[0].number };
      }
    }
    throw error;
  }
}

/**
 * Expédie un transfert préparé (passage en transit).
 */
export async function shipTransfer(
  context: AuthContext,
  transferId: string,
  input: TransferShipInput = { note: null },
): Promise<void> {
  const db = getDb();
  const shopId = context.shop.id;

  const transfer = await getTransfer(shopId, transferId);
  if (!transfer) {
    throw new ApiError(404, "transfer_not_found", "Transfert introuvable.");
  }

  if (transfer.status !== "prepared") {
    throw new ApiError(
      422,
      "invalid_transfer_status",
      `Le transfert ne peut pas être expédié car son statut actuel est « ${transfer.status} ».`,
    );
  }

  // Vérifier l'accès à l'entrepôt source
  await resolveWarehouse(context, transfer.fromWarehouseId);

  await db.transaction(async (tx) => {
    await tx
      .update(warehouseTransfers)
      .set({
        status: "shipped",
        shippedAt: new Date(),
        shippedBy: context.user.id,
        note: input.note ? `${transfer.note ?? ""}\n[Expédition] ${input.note}`.trim() : transfer.note,
      })
      .where(
        and(
          eq(warehouseTransfers.id, transferId),
          eq(warehouseTransfers.shopId, shopId),
        ),
      );

    await writeAudit(tx as never, {
      shopId,
      userId: context.user.id,
      action: "transfer.ship",
      entityType: "warehouse_transfer",
      entityId: transfer.id,
      metadata: { number: transfer.number },
    });
  });
}

/**
 * Réceptionne un transfert dans l'entrepôt de destination.
 * Incrémente le stock de l'entrepôt de destination (`transfer_in`).
 * En cas d'écart constaté (ex. avarie/perte en transit), la perte est déduite
 * du total global de l'entreprise `products.quantity` et tracée.
 */
export async function receiveTransfer(
  context: AuthContext,
  transferId: string,
  input: TransferReceiveInput,
): Promise<void> {
  const db = getDb();
  const shopId = context.shop.id;

  const transfer = await getTransfer(shopId, transferId);
  if (!transfer) {
    throw new ApiError(404, "transfer_not_found", "Transfert introuvable.");
  }

  if (transfer.status !== "prepared" && transfer.status !== "shipped") {
    throw new ApiError(
      422,
      "invalid_transfer_status",
      `Le transfert ne peut pas être reçu car son statut actuel est « ${transfer.status} ».`,
    );
  }

  // Vérifier l'accès à l'entrepôt de destination
  await resolveWarehouse(context, transfer.toWarehouseId);

  const sentMap = new Map(transfer.items.map((i) => [i.productId, i]));

  // Vérifier que tous les articles soumis correspondent aux articles envoyés
  for (const item of input.items) {
    const sentItem = sentMap.get(item.productId);
    if (!sentItem) {
      throw new ApiError(
        422,
        "unexpected_product",
        `Le produit ${item.productId} ne fait pas partie de ce transfert.`,
      );
    }
    if (item.quantityReceived > sentItem.quantitySent) {
      throw new ApiError(
        422,
        "quantity_exceeded",
        `La quantité reçue pour « ${sentItem.productName} » (${item.quantityReceived}) dépasse la quantité expédiée (${sentItem.quantitySent}).`,
      );
    }
  }

  if (input.items.length !== transfer.items.length) {
    throw new ApiError(
      422,
      "missing_items",
      "Toutes les lignes du transfert doivent être confirmées à la réception.",
    );
  }

  await db.transaction(async (tx) => {
    for (const item of input.items) {
      const sentItem = sentMap.get(item.productId)!;

      // 1. Assurer la ligne de stock dans l'entrepôt destination
      await ensureWarehouseStockRow(tx, {
        shopId,
        warehouseId: transfer.toWarehouseId,
        productId: sentItem.productId,
      });

      // 2. Incrémenter le stock destination si > 0
      if (item.quantityReceived > 0) {
        await applyWarehouseDelta(tx, {
          shopId,
          warehouseId: transfer.toWarehouseId,
          productId: sentItem.productId,
          delta: item.quantityReceived,
          productName: sentItem.productName,
        });

        // Mouvement d'entrée transfert
        await tx.insert(stockMovements).values({
          shopId,
          productId: sentItem.productId,
          warehouseId: transfer.toWarehouseId,
          userId: context.user.id,
          transferId: transfer.id,
          type: "transfer_in",
          quantityDelta: item.quantityReceived,
          reason: `Réception transfert ${transfer.number} depuis ${transfer.fromWarehouse.name}`,
        });
      }

      // 3. Si écart (perte/casse en transit) : décrémenter le stock total global du produit
      const discrepancy = sentItem.quantitySent - item.quantityReceived;
      if (discrepancy > 0) {
        await applyProductTotalDelta(tx, {
          shopId,
          productId: sentItem.productId,
          delta: -discrepancy,
        });

        // Mouvement traçant la perte / casse constatée à la réception
        await tx.insert(stockMovements).values({
          shopId,
          productId: sentItem.productId,
          warehouseId: transfer.toWarehouseId,
          userId: context.user.id,
          transferId: transfer.id,
          type: "adjustment",
          quantityDelta: -discrepancy,
          reason: item.discrepancyReason
            ? `Perte transfert ${transfer.number} : ${item.discrepancyReason}`
            : `Écart constaté sur transfert ${transfer.number}`,
        });
      }

      // 4. Mettre à jour la ligne de transfert
      await tx
        .update(warehouseTransferItems)
        .set({
          quantityReceived: item.quantityReceived,
          discrepancyReason: item.discrepancyReason ?? null,
        })
        .where(
          and(
            eq(warehouseTransferItems.transferId, transfer.id),
            eq(warehouseTransferItems.productId, sentItem.productId),
          ),
        );
    }

    // 5. Clôturer le transfert
    await tx
      .update(warehouseTransfers)
      .set({
        status: "received",
        receivedAt: new Date(),
        receivedBy: context.user.id,
        note: input.note ? `${transfer.note ?? ""}\n[Réception] ${input.note}`.trim() : transfer.note,
      })
      .where(
        and(
          eq(warehouseTransfers.id, transfer.id),
          eq(warehouseTransfers.shopId, shopId),
        ),
      );

    // 6. Journal d'audit
    await writeAudit(tx as never, {
      shopId,
      userId: context.user.id,
      action: "transfer.receive",
      entityType: "warehouse_transfer",
      entityId: transfer.id,
      metadata: {
        number: transfer.number,
        toWarehouseId: transfer.toWarehouseId,
      },
    });
  });
}

/**
 * Annule un transfert préparé ou expédié.
 * Réintègre intégralement les marchandises dans l'entrepôt d'origine.
 */
export async function cancelTransfer(
  context: AuthContext,
  transferId: string,
  input: TransferCancelInput,
): Promise<void> {
  const db = getDb();
  const shopId = context.shop.id;

  const transfer = await getTransfer(shopId, transferId);
  if (!transfer) {
    throw new ApiError(404, "transfer_not_found", "Transfert introuvable.");
  }

  if (transfer.status !== "prepared" && transfer.status !== "shipped") {
    throw new ApiError(
      422,
      "invalid_transfer_status",
      `Le transfert ne peut plus être annulé car son statut est « ${transfer.status} ».`,
    );
  }

  // Vérifier l'accès à l'entrepôt d'origine
  await resolveWarehouse(context, transfer.fromWarehouseId);

  await db.transaction(async (tx) => {
    // Réintégrer chaque article dans l'entrepôt d'origine
    for (const item of transfer.items) {
      await applyWarehouseDelta(tx, {
        shopId,
        warehouseId: transfer.fromWarehouseId,
        productId: item.productId,
        delta: item.quantitySent,
        productName: item.productName,
      });

      // Mouvement compensatoire
      await tx.insert(stockMovements).values({
        shopId,
        productId: item.productId,
        warehouseId: transfer.fromWarehouseId,
        userId: context.user.id,
        transferId: transfer.id,
        type: "reversal",
        quantityDelta: item.quantitySent,
        reason: `Annulation transfert ${transfer.number} : ${input.reason}`,
      });
    }

    // Mettre à jour le statut du transfert
    await tx
      .update(warehouseTransfers)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: context.user.id,
        cancelReason: input.reason,
      })
      .where(
        and(
          eq(warehouseTransfers.id, transfer.id),
          eq(warehouseTransfers.shopId, shopId),
        ),
      );

    await writeAudit(tx as never, {
      shopId,
      userId: context.user.id,
      action: "transfer.cancel",
      entityType: "warehouse_transfer",
      entityId: transfer.id,
      metadata: {
        number: transfer.number,
        reason: input.reason,
      },
    });
  });
}

import type { Database } from "@/server/db";
import { auditLogs } from "@/server/db/schema";

export interface AuditEntry {
  shopId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipHash?: string | null;
}

/**
 * Écrit une entrée du journal d'audit.
 * La table est protégée en base contre UPDATE et DELETE (voir migration 0001).
 * `executor` peut être la base ou une transaction Drizzle.
 */
export async function writeAudit(
  executor: Pick<Database, "insert">,
  entry: AuditEntry,
): Promise<void> {
  await executor.insert(auditLogs).values({
    shopId: entry.shopId ?? null,
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    ipHash: entry.ipHash ?? null,
  });
}

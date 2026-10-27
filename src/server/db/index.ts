import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Pool PostgreSQL unique par processus.
 * En développement, Next.js recharge les modules : on conserve le pool
 * sur globalThis pour éviter de saturer les connexions Neon.
 */
type GlobalWithPool = typeof globalThis & { __stockelyPool?: Pool };

const globalForDb = globalThis as GlobalWithPool;

function createPool(): Pool {
  const { DATABASE_URL } = getEnv();
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL) || DATABASE_URL.includes("localhost");

  return new Pool({
    connectionString: DATABASE_URL,
    max: isLocal ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  });
}

export function getPool(): Pool {
  if (!globalForDb.__stockelyPool || globalForDb.__stockelyPool.ended) {
    globalForDb.__stockelyPool = createPool();
  }
  return globalForDb.__stockelyPool;
}

export async function closePool(): Promise<void> {
  if (globalForDb.__stockelyPool) {
    const pool = globalForDb.__stockelyPool;
    globalForDb.__stockelyPool = undefined;
    await pool.end();
  }
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

export type Database = ReturnType<typeof getDb>;

export { schema };

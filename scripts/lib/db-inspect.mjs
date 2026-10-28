import { readFile } from "node:fs/promises";

export const MULTI_WAREHOUSE_TABLES = [
  "warehouses",
  "warehouse_stock",
  "warehouse_access",
];

export const TRANSFER_TABLES = [
  "warehouse_transfers",
  "warehouse_transfer_items",
  "transfer_counters",
];

const COUNTED_TABLES = [
  "shops",
  "memberships",
  "users",
  "products",
  "customers",
  "suppliers",
  "sales",
  "stock_movements",
  "warehouses",
  "warehouse_stock",
];

async function existingTables(pool) {
  const { rows } = await pool.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`,
  );
  return new Set(rows.map((row) => row.table_name));
}

async function existingColumns(pool, table) {
  const { rows } = await pool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public' and table_name = $1`,
    [table],
  );
  return new Set(rows.map((row) => row.column_name));
}

async function migrationState(pool, journalPath) {
  let journal = [];
  try {
    journal = JSON.parse(await readFile(journalPath, "utf8")).entries ?? [];
  } catch {
    return { available: false, journalTotal: 0, applied: 0, pending: 0 };
  }

  try {
    const { rows } = await pool.query(
      `select count(*)::int as applied, max(created_at) as latest
       from drizzle.__drizzle_migrations`,
    );
    const applied = rows[0]?.applied ?? 0;
    return {
      available: true,
      journalTotal: journal.length,
      applied,
      pending: Math.max(0, journal.length - applied),
      latestAppliedAt: rows[0]?.latest ?? null,
    };
  } catch {
    return {
      available: false,
      journalTotal: journal.length,
      applied: 0,
      pending: journal.length,
    };
  }
}

async function invariantCounts(pool, tables, columnsByTable) {
  const has = (table) => tables.has(table);
  const hasColumn = (table, column) => columnsByTable[table]?.has(column) ?? false;

  const invariants = {
    shopsWithoutDefaultWarehouse: null,
    productsWithMismatchedCache: null,
    negativeStockRows: null,
    salesWithoutWarehouse: null,
    movementsWithoutWarehouse: null,
  };
  if (!has("warehouses")) return invariants;

  const shops = await pool.query(
    `select count(*)::int as total
     from shops s
     where s.archived_at is null
       and not exists (
         select 1 from warehouses w
         where w.shop_id = s.id and w.is_default = true and w.is_active = true
       )`,
  );
  invariants.shopsWithoutDefaultWarehouse = shops.rows[0].total;

  if (has("warehouse_stock") && has("products")) {
    const mismatch = await pool.query(
      `select count(*)::int as total
       from products p
       where p.quantity <> coalesce(
         (select sum(ws.quantity) from warehouse_stock ws where ws.product_id = p.id),
         0
       )`,
    );
    invariants.productsWithMismatchedCache = mismatch.rows[0].total;

    const negative = await pool.query(
      `select count(*)::int as total from warehouse_stock where quantity < 0`,
    );
    invariants.negativeStockRows = negative.rows[0].total;
  }

  if (hasColumn("sales", "warehouse_id")) {
    const sales = await pool.query(
      `select count(*)::int as total from sales where warehouse_id is null`,
    );
    invariants.salesWithoutWarehouse = sales.rows[0].total;
  }

  if (hasColumn("stock_movements", "warehouse_id")) {
    const movements = await pool.query(
      `select count(*)::int as total
       from stock_movements where warehouse_id is null`,
    );
    invariants.movementsWithoutWarehouse = movements.rows[0].total;
  }

  return invariants;
}

/**
 * Inspection strictement en lecture seule d'une base PostgreSQL.
 * Ne prend aucune décision : expose l'état pour les scripts et le runbook.
 */
export async function inspectDatabase(
  pool,
  { journalPath = "drizzle/meta/_journal.json" } = {},
) {
  const meta = await pool.query(
    `select current_database() as database,
            current_user as username,
            current_setting('server_version_num')::int as version_number,
            version() as version`,
  );
  const { database, username, version_number, version } = meta.rows[0];

  const tables = await existingTables(pool);
  const columnsByTable = {};
  for (const table of ["sales", "stock_movements", "products"]) {
    if (tables.has(table)) columnsByTable[table] = await existingColumns(pool, table);
  }

  const corePresent = MULTI_WAREHOUSE_TABLES.filter((table) => tables.has(table));
  const transferPresent = TRANSFER_TABLES.filter((table) => tables.has(table));
  const partial =
    (corePresent.length > 0 && corePresent.length < MULTI_WAREHOUSE_TABLES.length) ||
    (transferPresent.length > 0 && transferPresent.length < TRANSFER_TABLES.length);

  const counts = {};
  for (const table of COUNTED_TABLES) {
    if (!tables.has(table)) continue;
    const { rows } = await pool.query(`select count(*)::int as total from "${table}"`);
    counts[table] = rows[0].total;
  }

  const migrations = await migrationState(pool, journalPath);
  const invariants = await invariantCounts(pool, tables, columnsByTable);

  return {
    database,
    username,
    versionNumber: version_number,
    version,
    tables: {
      existing: [...tables].sort(),
      missingMultiWarehouse: MULTI_WAREHOUSE_TABLES.filter((table) => !tables.has(table)),
      missingTransfers: TRANSFER_TABLES.filter((table) => !tables.has(table)),
    },
    multiWarehouseReady: MULTI_WAREHOUSE_TABLES.every((table) => tables.has(table)),
    transfersReady: TRANSFER_TABLES.every((table) => tables.has(table)),
    partial,
    migrations,
    counts,
    invariants,
    checkedAt: new Date(),
  };
}

export function listInvariantProblems(invariants) {
  if (!invariants) return [];
  const labels = {
    shopsWithoutDefaultWarehouse: "boutique sans entrepôt par défaut actif",
    productsWithMismatchedCache: "produit dont le cache quantity diffère du total entrepôts",
    negativeStockRows: "ligne de stock négative",
    salesWithoutWarehouse: "vente sans entrepôt",
    movementsWithoutWarehouse: "mouvement sans entrepôt",
  };
  return Object.entries(labels)
    .filter(([key]) => typeof invariants[key] === "number" && invariants[key] > 0)
    .map(([key, label]) => `${invariants[key]} ${label}${invariants[key] > 1 ? "s" : ""}`);
}

export function formatReport(report) {
  const lines = [];
  lines.push(`Base          : ${report.database}`);
  lines.push(`Utilisateur   : ${report.username}`);
  lines.push(`PostgreSQL    : ${report.version.split(",")[0]}`);
  lines.push("");

  const migration = report.migrations;
  if (migration.available) {
    lines.push(
      `Migrations    : ${migration.applied}/${migration.journalTotal} appliquée(s), ${migration.pending} en attente`,
    );
    if (migration.latestAppliedAt) {
      const raw = migration.latestAppliedAt;
      const numeric = Number(raw);
      const appliedDate = Number.isFinite(numeric) && String(raw).length >= 10
        ? new Date(numeric)
        : new Date(raw);
      if (!Number.isNaN(appliedDate.getTime())) {
        lines.push(`Dernière      : ${appliedDate.toISOString()}`);
      }
    }
  } else {
    lines.push(
      `Migrations    : suivi Drizzle absent (${migration.pending} migration(s) à appliquer)`,
    );
  }

  lines.push(
    `Multi-entrepôt: ${report.multiWarehouseReady ? "schéma présent" : "schéma absent"}`,
  );
  lines.push(
    `Transferts    : ${report.transfersReady ? "schéma présent" : "schéma absent"}`,
  );
  if (report.partial) {
    lines.push("ALERTE        : schéma partiellement appliqué, intervention manuelle requise");
  }

  const counts = Object.entries(report.counts);
  if (counts.length > 0) {
    lines.push("");
    lines.push("Volumes       :");
    for (const [table, total] of counts) {
      lines.push(`  ${table.padEnd(18)} ${total}`);
    }
  }

  const problems = listInvariantProblems(report.invariants);
  lines.push("");
  if (problems.length === 0) {
    lines.push(
      report.multiWarehouseReady
        ? "Invariants    : OK"
        : "Invariants    : non vérifiables avant la migration 0003",
    );
  } else {
    lines.push("Invariants    : ÉCHEC");
    for (const problem of problems) lines.push(`  - ${problem}`);
  }

  return lines.join("\n");
}

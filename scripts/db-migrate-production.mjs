/**
 * Applique les migrations Drizzle à la base ciblée par DATABASE_URL.
 *
 * Garde-fous :
 *  - refuse une base dont le nom ressemble à une base de test ;
 *  - exige --confirm=APPLY ;
 *  - exige BACKUP_REFERENCE (référence de la branche Neon ou du dump vérifié) ;
 *  - refuse un schéma partiellement appliqué ;
 *  - verrou consultatif pour empêcher deux exécutions simultanées ;
 *  - vérifie les invariants après migration et sort en erreur sinon.
 *
 * Usage :
 *   BACKUP_REFERENCE="neon:br-... (2026-10-28)" npm run db:migrate:prod -- --confirm=APPLY
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { formatReport, inspectDatabase, listInvariantProblems } from "./lib/db-inspect.mjs";

const LOCK_KEY = 7283041121;

const args = process.argv.slice(2);
const confirmed = args.includes("--confirm=APPLY");
const backupReference = (process.env.BACKUP_REFERENCE ?? "").trim();
const url = process.env.DATABASE_URL;

function abort(message) {
  console.error(`\nRefus : ${message}`);
  process.exit(1);
}

if (!url) abort("DATABASE_URL manquant.");
if (!confirmed) {
  abort(
    "ajouter --confirm=APPLY après avoir vérifié la cible et la sauvegarde.",
  );
}
if (backupReference.length < 4) {
  abort(
    "BACKUP_REFERENCE manquant. Indiquer la branche Neon ou le dump utilisé (ex. BACKUP_REFERENCE=\"neon:br-abc123\").",
  );
}

const parsed = new URL(url);
const databaseName = parsed.pathname.replace(/^\//, "");
if (/(^|_)test($|_)/i.test(databaseName)) {
  abort(`la base "${databaseName}" ressemble à une base de test.`);
}

const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
const pool = new Pool({
  connectionString: url,
  max: 2,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
  application_name: "stockely-migrate",
});

let lockAcquired = false;

try {
  const before = await inspectDatabase(pool);
  console.log("=== Avant migration ===");
  console.log(formatReport(before));
  console.log(`\nSauvegarde    : ${backupReference}`);

  if (before.partial) {
    abort(
      "schéma partiellement appliqué. Restaurer la sauvegarde ou terminer l'intervention manuellement avant de relancer.",
    );
  }
  if (before.versionNumber < 120000) {
    abort(
      `PostgreSQL ${before.versionNumber} trop ancien : la migration 0004 ajoute des valeurs d'enum dans une transaction (PostgreSQL 12 minimum).`,
    );
  }

  if (before.migrations.pending === 0) {
    console.log("\nAucune migration en attente.");
    const problems = listInvariantProblems(before.invariants);
    if (problems.length > 0) {
      console.error("\nInvariants en échec :");
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exitCode = 1;
    }
    process.exit(0);
  }

  const lock = await pool.query("select pg_try_advisory_lock($1) as locked", [LOCK_KEY]);
  if (!lock.rows[0]?.locked) {
    abort("une autre migration est déjà en cours sur cette base.");
  }
  lockAcquired = true;

  console.log(
    `\nApplication de ${before.migrations.pending} migration(s) sur "${databaseName}"…`,
  );
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });

  const after = await inspectDatabase(pool);
  console.log("\n=== Après migration ===");
  console.log(formatReport(after));

  const problems = listInvariantProblems(after.invariants);
  const failures = [];
  if (after.partial) failures.push("schéma partiellement appliqué");
  if (after.migrations.pending > 0) {
    failures.push(`${after.migrations.pending} migration(s) encore en attente`);
  }
  failures.push(...problems);

  if (failures.length > 0) {
    console.error("\nMigration terminée mais vérification en échec :");
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error("\nRestaurer la branche de sauvegarde et analyser avant de continuer.");
    process.exitCode = 1;
  } else {
    console.log("\nMigration appliquée et invariants vérifiés.");
  }
} catch (error) {
  console.error("\nÉchec de la migration. La transaction en cours a été annulée.");
  if (process.env.DEBUG_DB === "1") console.error(error);
  process.exitCode = 1;
} finally {
  if (lockAcquired) {
    await pool.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  }
  await pool.end();
}

/**
 * État en lecture seule d'une base Stockely.
 *
 * Usage :
 *   npm run db:status              # utilise DATABASE_URL
 *   npm run db:status -- --url=... # cible explicite
 *
 * Aucune écriture, aucune migration : uniquement des SELECT.
 */
import "dotenv/config";
import { Pool } from "pg";

import { formatReport, inspectDatabase, listInvariantProblems } from "./lib/db-inspect.mjs";

const argument = process.argv.find((value) => value.startsWith("--url="));
const url = argument ? argument.slice("--url=".length) : process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL manquant (ou passer --url=postgres://...).");
  process.exit(1);
}

const parsed = new URL(url);
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
const pool = new Pool({
  connectionString: url,
  max: 2,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
  application_name: "stockely-status",
});

try {
  const report = await inspectDatabase(pool);
  console.log(formatReport(report));

  const problems = listInvariantProblems(report.invariants);
  if (report.partial) {
    console.error(
      "\nÉtat incohérent : une partie seulement du schéma multi-entrepôts est présente.",
    );
    process.exitCode = 1;
  } else if (problems.length > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Inspection impossible.");
  if (process.env.DEBUG_DB === "1") console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}

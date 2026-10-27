/**
 * Applique les migrations à la base de test uniquement.
 * Garde-fou : refuse toute URL dont le nom de base ne contient pas "test".
 *
 * Usage : npm run db:migrate:test
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  console.error("TEST_DATABASE_URL manquant.");
  process.exit(1);
}

const databaseName = new URL(url).pathname.replace(/^\//, "");
if (!/(^|_)test($|_)/i.test(databaseName)) {
  console.error(
    `Refus : la base "${databaseName}" ne ressemble pas à une base de test.`,
  );
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new Pool({
  connectionString: url,
  max: 2,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.log(`Migrations appliquées à la base de test "${databaseName}".`);
} catch {
  console.error("Échec des migrations de test (détail masqué).");
  process.exitCode = 1;
} finally {
  await pool.end();
}

/**
 * Crée une base PostgreSQL dans le cluster courant (utile sur Neon).
 * Ne modifie aucune donnée existante et ne supprime rien.
 *
 * Usage :
 *   node scripts/create-database.mjs stockely
 */
import "dotenv/config";
import { Client } from "pg";

const target = process.argv[2];

if (!target || !/^[a-z][a-z0-9_]{1,62}$/.test(target)) {
  console.error("Nom de base invalide. Exemple : node scripts/create-database.mjs stockely");
  process.exit(1);
}

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}

const url = new URL(baseUrl);
// Les commandes DDL passent par la connexion directe, pas par le pooler.
url.hostname = url.hostname.replace("-pooler", "");
url.pathname = `/${url.pathname.split("/")[1] || "neondb"}`;

const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });

try {
  await client.connect();
  const existing = await client.query("select 1 from pg_database where datname = $1", [target]);
  if (existing.rowCount) {
    console.log(`La base "${target}" existe déjà. Aucune modification.`);
  } else {
    await client.query(`create database "${target}"`);
    console.log(`Base "${target}" créée.`);
  }
} catch {
  console.error("Échec de la création de la base (détail masqué).");
  process.exitCode = 1;
} finally {
  await client.end();
}

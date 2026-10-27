/**
 * Vérification en lecture seule de l'invariant multi-entrepôts.
 *
 * Usage :
 *   npm run db:check:warehouses
 *
 * Vérifie que :
 *   - chaque boutique possède au moins un entrepôt ;
 *   - products.quantity = somme(warehouse_stock.quantity) pour chaque produit ;
 *   - aucune quantité n'est négative.
 *
 * Sort avec le code 1 si un écart est détecté. Aucune écriture n'est effectuée.
 */
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const pool = new pg.Pool({
  connectionString: url,
  max: 2,
  ssl: isLocal ? undefined : { rejectUnauthorized: true },
});

try {
  const [shops, mismatches, negatives, totals] = await Promise.all([
    pool.query(
      `select count(*)::int as count
       from shops s
       where not exists (select 1 from warehouses w where w.shop_id = s.id)`,
    ),
    pool.query(
      `select count(*)::int as count
       from products p
       where p.quantity <> coalesce((
         select sum(ws.quantity) from warehouse_stock ws where ws.product_id = p.id
       ), 0)`,
    ),
    pool.query(
      `select count(*)::int as count from warehouse_stock where quantity < 0`,
    ),
    pool.query(
      `select
         (select count(*)::int from warehouses where archived_at is null) as warehouses,
         (select count(*)::int from products) as products,
         (select coalesce(sum(quantity), 0)::int from products) as product_total,
         (select coalesce(sum(quantity), 0)::int from warehouse_stock) as stock_total`,
    ),
  ]);

  const report = {
    shopsWithoutWarehouse: shops.rows[0]?.count ?? 0,
    productsWithMismatch: mismatches.rows[0]?.count ?? 0,
    negativeStockRows: negatives.rows[0]?.count ?? 0,
    ...totals.rows[0],
  };

  console.log(JSON.stringify(report, null, 2));

  if (
    report.shopsWithoutWarehouse > 0 ||
    report.productsWithMismatch > 0 ||
    report.negativeStockRows > 0 ||
    report.product_total !== report.stock_total
  ) {
    console.error("Invariant multi-entrepôts invalide.");
    process.exitCode = 1;
  } else {
    console.log("Invariant multi-entrepôts valide.");
  }
} finally {
  await pool.end();
}

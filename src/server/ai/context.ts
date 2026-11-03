import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { AuthContext } from "@/server/auth/context";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { getDashboardOverview } from "@/server/services/dashboard";
import { getSalesReport } from "@/server/services/reports";
import { listAccessibleWarehouses } from "@/server/services/warehouses";

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Instantané compact de la boutique pour l'assistant.
 * Aucune donnée nominative client n'est transmise : seuls les agrégats,
 * les produits et les entrepôts sont exposés au modèle.
 */
export async function buildAssistantContext(context: AuthContext) {
  const { shop, permissions } = context;
  const [warehouse, accessibleWarehouses] = await Promise.all([
    resolveRequestWarehouse(context),
    listAccessibleWarehouses(context),
  ]);
  const overview = await getDashboardOverview(
    shop.id,
    shop.timezone,
    warehouse.id,
  );
  const accessibleIds = new Set(accessibleWarehouses.map((entry) => entry.id));

  const report = permissions.has("reports.read")
    ? await getSalesReport(shop.id, shop.timezone, isoDaysAgo(29), todayIso())
    : null;

  return {
    boutique: {
      nom: shop.name,
      devise: shop.currency,
      fuseau: shop.timezone,
    },
    stock: {
      entrepot_actif: { nom: warehouse.name, code: warehouse.code },
      references_actives: overview.productCount,
      unites_en_stock: overview.stockUnits,
      valeur_stock: formatMoney(overview.stockValueCents, shop.currency),
      ruptures: overview.outOfStockCount,
      stocks_faibles: overview.lowStockCount,
      par_entrepot: overview.stockByWarehouse
        .filter((entry) => accessibleIds.has(entry.id))
        .map((entry) => ({
          nom: entry.name,
          code: entry.code,
          unites: entry.units,
          valeur: formatMoney(entry.valueCents, shop.currency),
        })),
    },
    ventes: {
      aujourd_hui: {
        nombre: overview.salesTodayCount,
        chiffre_affaires: formatMoney(overview.revenueTodayCents, shop.currency),
      },
      mois_en_cours: {
        nombre: overview.monthSalesCount,
        chiffre_affaires: formatMoney(overview.monthRevenueCents, shop.currency),
      },
      mois_precedent: {
        nombre: overview.previousMonthSalesCount,
        chiffre_affaires: formatMoney(
          overview.previousMonthRevenueCents,
          shop.currency,
        ),
      },
      sept_derniers_jours: overview.salesSeries.map((day) => ({
        date: day.date,
        ventes: day.count,
        chiffre_affaires: formatMoney(day.revenueCents, shop.currency),
      })),
    },
    produits: {
      plus_vendus: overview.topProducts.map((product) => ({
        nom: product.name,
        quantite_vendue: product.quantity,
        chiffre_affaires: formatMoney(product.revenueCents, shop.currency),
      })),
      alertes_stock: overview.lowStockProducts.map((product) => ({
        nom: product.name,
        sku: product.sku,
        quantite: product.quantity,
        seuil: product.minStock,
      })),
    },
    ...(report
      ? {
          trente_derniers_jours: {
            ventes_terminees: report.totals.count,
            chiffre_affaires: formatMoney(report.totals.revenue, shop.currency),
            panier_moyen: formatMoney(report.totals.averageBasket, shop.currency),
            marge_brute: formatMoney(report.totals.margin, shop.currency),
            remises: formatMoney(report.totals.discount, shop.currency),
            encaissements: report.payments.map((payment) => ({
              moyen: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
              montant: formatMoney(payment.amount, shop.currency),
              nombre: payment.count,
            })),
            meilleurs_produits: report.topProducts.map((product) => ({
              nom: product.productName,
              quantite: product.quantity,
              chiffre_affaires: formatMoney(product.revenue, shop.currency),
              marge: product.complete
                ? formatMoney(product.margin, shop.currency)
                : "coûts incomplets",
            })),
          },
        }
      : {}),
    genere_le: new Date().toISOString(),
  };
}

/** Contexte d'une période de rapport, utilisé pour la synthèse IA. */
export async function buildReportContext(
  context: AuthContext,
  from: string,
  to: string,
) {
  const report = await getSalesReport(
    context.shop.id,
    context.shop.timezone,
    from,
    to,
  );
  const currency = context.shop.currency;

  return {
    boutique: {
      nom: context.shop.name,
      devise: currency,
      fuseau: context.shop.timezone,
    },
    periode: { du: from, au: to },
    totaux: {
      ventes_terminees: report.totals.count,
      chiffre_affaires: formatMoney(report.totals.revenue, currency),
      sous_total: formatMoney(report.totals.subtotal, currency),
      remises: formatMoney(report.totals.discount, currency),
      cout_marchandises: formatMoney(report.totals.cost, currency),
      marge_brute: formatMoney(report.totals.margin, currency),
      panier_moyen: formatMoney(report.totals.averageBasket, currency),
    },
    evolution_quotidienne: report.daily.map((day) => ({
      date: day.day,
      ventes: day.count,
      chiffre_affaires: formatMoney(day.revenue, currency),
    })),
    meilleurs_produits: report.topProducts.map((product) => ({
      nom: product.productName,
      sku: product.sku,
      quantite: product.quantity,
      chiffre_affaires: formatMoney(product.revenue, currency),
      marge: product.complete
        ? formatMoney(product.margin, currency)
        : "coûts incomplets",
    })),
    encaissements: report.payments.map((payment) => ({
      moyen: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      montant: formatMoney(payment.amount, currency),
      nombre: payment.count,
    })),
    stock: {
      references_actives: report.inventory.activeProducts,
      unites: report.inventory.units,
      valeur: formatMoney(report.inventory.value, currency),
      ruptures: report.inventory.outCount,
      stocks_faibles: report.inventory.lowCount,
      alertes: report.lowStock.map((product) => ({
        nom: product.name,
        sku: product.sku,
        quantite: product.quantity,
        seuil: product.minStock,
      })),
    },
    genere_le: new Date().toISOString(),
  };
}

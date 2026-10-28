import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import {
  Avatar,
  DonutChart,
  KpiCard,
  ProgressBar,
  SalesAreaChart,
} from "@/components/ui/metrics";
import {
  EmptyState,
  SectionCard,
  StatusPill,
} from "@/components/ui/page";
import { formatDate, formatDayTime, formatInteger, formatMoney } from "@/lib/money";
import { getAuthContext } from "@/server/auth/context";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { getDashboardOverview } from "@/server/services/dashboard";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tableau de bord",
};

const MOVEMENT_LABELS: Record<string, string> = {
  in: "Entrée",
  out: "Sortie",
  sale: "Vente",
  customer_return: "Retour client",
  supplier_return: "Retour fournisseur",
  adjustment: "Correction",
  reversal: "Compensation",
};

const WAREHOUSE_COLORS = [
  "#2E7D5B",
  "#E9D66B",
  "#8FB79A",
  "#C9A66B",
  "#8FA7A0",
];

function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function shortDayLabel(dateKey: string, timezone: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
  })
    .format(date)
    .replace(".", "");
}

export default async function DashboardPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  let data;
  let warehouseName = "tous entrepôts";
  try {
    const warehouse = await resolveRequestWarehouse(context);
    warehouseName = warehouse.name;
    data = await getDashboardOverview(
      context.shop.id,
      context.shop.timezone,
      warehouse.id,
    );
  } catch {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
        <h1 className="text-lg font-bold">Données indisponibles</h1>
        <p className="mt-2 max-w-lg text-[0.875rem] leading-6 text-muted">
          Le tableau de bord ne peut pas être chargé pour le moment. Vérifiez la
          connexion à la base de données, puis rechargez la page.
        </p>
      </div>
    );
  }

  const firstName = context.user.name.split(/\s+/)[0] ?? context.user.name;
  const today = formatDate(new Date(), context.shop.timezone);
  const canSell = context.permissions.has("sales.create");
  const canWriteProducts = context.permissions.has("products.write");

  const monthDelta = percentChange(
    data.monthRevenueCents,
    data.previousMonthRevenueCents,
  );
  const todayShare =
    data.monthRevenueCents > 0
      ? (data.revenueTodayCents / data.monthRevenueCents) * 100
      : 0;
  const healthyProducts = Math.max(
    0,
    data.productCount - data.outOfStockCount - data.lowStockCount,
  );
  const healthPct =
    data.productCount > 0 ? (healthyProducts / data.productCount) * 100 : 100;
  const alertCount = data.outOfStockCount + data.lowStockCount;

  const weeklyRevenue = data.salesSeries.reduce(
    (sum, point) => sum + point.revenueCents,
    0,
  );

  const chartData = data.salesSeries.map((point) => ({
    label: shortDayLabel(point.date, context.shop.timezone),
    value: point.revenueCents,
    tooltip: `${formatMoney(point.revenueCents, context.shop.currency)} · ${formatInteger(point.count)} vente${point.count > 1 ? "s" : ""}`,
  }));

  const warehousesWithStock = data.stockByWarehouse.filter(
    (warehouse) => warehouse.units > 0,
  );
  const visibleWarehouses = warehousesWithStock.slice(0, 4);
  const otherUnits = warehousesWithStock
    .slice(4)
    .reduce((sum, warehouse) => sum + warehouse.units, 0);
  const stockSegments = visibleWarehouses.map((warehouse, index) => ({
    label: warehouse.name,
    value: warehouse.units,
    color: WAREHOUSE_COLORS[index % WAREHOUSE_COLORS.length]!,
  }));
  if (otherUnits > 0) {
    stockSegments.push({
      label: "Autres entrepôts",
      value: otherUnits,
      color: WAREHOUSE_COLORS[4]!,
    });
  }
  const totalWarehouseUnits = stockSegments.reduce(
    (sum, segment) => sum + segment.value,
    0,
  );
  const maxTopQuantity = Math.max(
    1,
    ...data.topProducts.map((product) => product.quantity),
  );

  return (
    <div className="animate-rise space-y-6">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.16em] text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-strong" />
            {today}
          </p>
          <h1 className="mt-2 text-balance text-[2rem] font-extrabold leading-[1.08] tracking-[-0.055em] sm:text-[2.4rem]">
            Bonjour, {firstName}.
          </h1>
          <p className="mt-2 max-w-2xl text-[0.875rem] leading-6 text-muted">
            Voici l&apos;état de {context.shop.name}. Stock et mouvements pour{" "}
            <span className="font-semibold text-ink">{warehouseName}</span>, ventes
            pour toute la boutique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSell && (
            <Link href="/sales/new" className={buttonClasses({ size: "sm" })}>
              <span aria-hidden="true" className="text-base leading-none">+</span>
              Nouvelle vente
            </Link>
          )}
          {canWriteProducts && (
            <Link
              href="/products/new"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Nouveau produit
            </Link>
          )}
        </div>
      </header>

      {alertCount > 0 && (
        <div
          role="status"
          className={cn(
            "flex flex-col gap-3 rounded-2xl border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between",
            data.outOfStockCount > 0
              ? "border-danger/15 bg-danger-soft/80"
              : "border-warning/20 bg-warning-soft/80",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                data.outOfStockCount > 0
                  ? "bg-white text-danger"
                  : "bg-white text-warning",
              )}
            >
              <Icon name="alert" className="h-4 w-4" />
            </span>
            <p className="text-[0.8125rem] leading-5 text-ink">
              <strong className="font-bold">
                {formatInteger(alertCount)} produit{alertCount > 1 ? "s" : ""} à
                surveiller
              </strong>{" "}
              dans {warehouseName} — {formatInteger(data.outOfStockCount)} en rupture
              et {formatInteger(data.lowStockCount)} sous le seuil.
            </p>
          </div>
          <Link
            href="/products?stock=low"
            className="shrink-0 text-[0.75rem] font-bold text-ink underline decoration-ink/25 underline-offset-4 hover:decoration-ink"
          >
            Réapprovisionner
          </Link>
        </div>
      )}

      <section aria-label="Indicateurs clés">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Chiffre d'affaires"
            value={formatMoney(data.monthRevenueCents, context.shop.currency)}
            hint={`${formatInteger(data.monthSalesCount)} vente${data.monthSalesCount > 1 ? "s" : ""} ce mois`}
            icon="wallet"
            tone="primary"
            trend={{ value: monthDelta, label: "vs mois dernier à date" }}
          />
          <KpiCard
            label="Ventes du jour"
            value={formatInteger(data.salesTodayCount)}
            hint={`${formatMoney(data.revenueTodayCents, context.shop.currency)} encaissés`}
            icon="receipt"
            tone="accent"
            footer={
              <div>
                <div className="flex items-center justify-between text-[0.625rem] font-semibold text-muted">
                  <span>Part du CA du mois</span>
                  <span className="tabular">{Math.round(todayShare)} %</span>
                </div>
                <ProgressBar
                  value={todayShare}
                  tone="accent"
                  className="mt-1.5"
                  label="Part du chiffre d'affaires du mois réalisée aujourd'hui"
                />
              </div>
            }
          />
          <KpiCard
            label="Unités en stock"
            value={formatInteger(data.stockUnits)}
            hint={`${formatMoney(data.stockValueCents, context.shop.currency)} de valeur · ${formatInteger(data.productCount)} références`}
            icon="boxes"
            tone="info"
          />
          <KpiCard
            label="Alertes stock"
            value={formatInteger(alertCount)}
            hint={
              alertCount > 0
                ? `${formatInteger(data.outOfStockCount)} ruptures · ${formatInteger(data.lowStockCount)} sous seuil`
                : "Tout le catalogue est au-dessus du seuil."
            }
            icon="alert"
            tone={data.outOfStockCount > 0 ? "danger" : "accent"}
            footer={
              <div>
                <div className="flex items-center justify-between text-[0.625rem] font-semibold text-muted">
                  <span>Catalogue sain</span>
                  <span className="tabular">{Math.round(healthPct)} %</span>
                </div>
                <ProgressBar
                  value={healthPct}
                  tone={data.outOfStockCount > 0 ? "danger" : "primary"}
                  className="mt-1.5"
                  label="Part du catalogue au-dessus du seuil de réapprovisionnement"
                />
              </div>
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,1fr)]">
        <div className="min-w-0 space-y-6">
          <SectionCard
            title="Activité des ventes"
            description="Chiffre d'affaires des 7 derniers jours, toute la boutique."
            actions={
              <div className="text-right">
                <p className="tabular text-[0.9375rem] font-extrabold tracking-[-0.03em]">
                  {formatMoney(weeklyRevenue, context.shop.currency)}
                </p>
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  sur 7 jours
                </p>
              </div>
            }
          >
            <div className="px-4 pb-5 sm:px-6">
              <SalesAreaChart
                data={chartData}
                formatValue={(value) => formatMoney(value, context.shop.currency)}
                ariaLabel={`Chiffre d'affaires des 7 derniers jours pour ${context.shop.name}`}
              />
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/70 pt-3 text-[0.6875rem] text-muted">
                <span>
                  Moyenne quotidienne{" "}
                  <strong className="font-semibold text-ink">
                    {formatMoney(Math.round(weeklyRevenue / 7), context.shop.currency)}
                  </strong>
                </span>
                <span>
                  Meilleure journée{" "}
                  <strong className="font-semibold text-ink">
                    {formatMoney(
                      Math.max(...data.salesSeries.map((point) => point.revenueCents)),
                      context.shop.currency,
                    )}
                  </strong>
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Dernières ventes"
            description={`${formatInteger(data.salesTodayCount)} vente${data.salesTodayCount > 1 ? "s" : ""} aujourd'hui.`}
            actions={
              <Link
                href="/sales"
                className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-primary-dark underline-offset-4 hover:underline"
              >
                Tout voir
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {data.recentSales.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState
                  title="Aucune vente enregistrée"
                  body="Les ventes validées apparaîtront ici avec leur montant et leur statut."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" className="px-5 py-3 font-bold sm:px-6">
                        Client
                      </th>
                      <th scope="col" className="hidden px-4 py-3 font-bold sm:table-cell">
                        Vente
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">
                        Montant
                      </th>
                      <th scope="col" className="hidden px-5 py-3 font-bold sm:table-cell">
                        Statut
                      </th>
                      <th scope="col" className="hidden px-4 py-3 text-right font-bold sm:table-cell">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {data.recentSales.map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-5 py-3 sm:px-6">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={sale.customerName ?? "Client de passage"}
                              size="sm"
                            />
                            <span className="min-w-0">
                              <span className="block max-w-[10rem] truncate font-semibold">
                                {sale.customerName ?? "Client de passage"}
                              </span>
                              <span className="tabular mt-0.5 block whitespace-nowrap font-mono text-[0.625rem] text-muted sm:hidden">
                                {formatDate(sale.createdAt, context.shop.timezone)}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                          <Link
                            href={`/sales/${sale.id}`}
                            className="tabular font-mono text-[0.6875rem] text-muted underline-offset-4 hover:text-primary-dark hover:underline"
                          >
                            {sale.number}
                          </Link>
                        </td>
                        <td className="tabular px-4 py-3 text-right font-mono font-semibold">
                          {formatMoney(sale.totalCents, context.shop.currency)}
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <StatusPill tone={sale.status === "cancelled" ? "danger" : "success"}>
                            {sale.status === "cancelled" ? "Annulée" : "Encaissée"}
                          </StatusPill>
                        </td>
                        <td className="tabular hidden whitespace-nowrap px-4 py-3 text-right font-mono text-[0.6875rem] text-muted sm:table-cell">
                          {formatDate(sale.createdAt, context.shop.timezone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Derniers mouvements"
            description={`Entrées, sorties et corrections · ${warehouseName}.`}
            actions={
              <Link
                href="/stock"
                className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-primary-dark underline-offset-4 hover:underline"
              >
                Tout voir
                <Icon name="arrow-right" className="h-3.5 w-3.5" />
              </Link>
            }
          >
            {data.recentMovements.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState
                  title="Aucun mouvement"
                  body="Les entrées, sorties et corrections de stock seront listées ici."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col" className="px-5 py-3 font-bold sm:px-6">
                        Produit
                      </th>
                      <th scope="col" className="hidden px-5 py-3 font-bold sm:table-cell">
                        Type
                      </th>
                      <th scope="col" className="hidden px-5 py-3 font-bold sm:table-cell">
                        Entrepôt
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-bold">
                        Quantité
                      </th>
                      <th scope="col" className="hidden px-4 py-3 text-right font-bold sm:table-cell">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {data.recentMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="px-5 py-3 font-semibold sm:px-6">
                          <span className="block">{movement.productName}</span>
                          <span className="tabular mt-0.5 block whitespace-nowrap font-mono text-[0.625rem] font-normal text-muted sm:hidden">
                            {formatDayTime(movement.createdAt, context.shop.timezone)}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 text-muted sm:table-cell">
                          {MOVEMENT_LABELS[movement.type] ?? movement.type}
                        </td>
                        <td className="hidden px-5 py-3 text-muted sm:table-cell">
                          {movement.warehouseName ?? "—"}
                        </td>
                        <td
                          className={cn(
                            "tabular px-4 py-3 text-right font-mono font-semibold",
                            movement.quantityDelta > 0 ? "text-primary-dark" : "text-ink",
                          )}
                        >
                          {movement.quantityDelta > 0 ? "+" : ""}
                          {formatInteger(movement.quantityDelta)}
                        </td>
                        <td className="tabular hidden whitespace-nowrap px-4 py-3 text-right font-mono text-[0.6875rem] text-muted sm:table-cell">
                          {formatDayTime(movement.createdAt, context.shop.timezone)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard
            title="Répartition du stock"
            description="Unités disponibles par entrepôt actif."
          >
            {totalWarehouseUnits === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState
                  title="Aucun stock disponible"
                  body="Les unités apparaîtront ici dès qu'un entrepôt sera approvisionné."
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 px-5 pb-5 sm:px-6">
                <DonutChart
                  segments={stockSegments}
                  centerValue={formatInteger(totalWarehouseUnits)}
                  centerLabel="unités tous entrepôts"
                  size={154}
                />
                <ul className="w-full space-y-3">
                  {stockSegments.map((segment) => {
                    const share = (segment.value / totalWarehouseUnits) * 100;
                    return (
                      <li key={segment.label} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: segment.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[0.75rem] font-semibold">
                              {segment.label}
                            </span>
                            <span className="tabular shrink-0 text-[0.6875rem] font-semibold text-muted">
                              {formatInteger(segment.value)} u.
                            </span>
                          </div>
                          <ProgressBar
                            value={share}
                            tone="primary"
                            className="mt-1.5"
                            label={`${segment.label} : ${Math.round(share)} % des unités`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Meilleures ventes"
            description="Classement par quantité vendue, toutes périodes."
            actions={
              <Link
                href="/reports"
                className="text-[0.75rem] font-bold text-primary-dark underline-offset-4 hover:underline"
              >
                Rapports
              </Link>
            }
          >
            {data.topProducts.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState
                  title="Pas encore de classement"
                  body="Le classement se construit à partir des ventes validées."
                />
              </div>
            ) : (
              <ol className="divide-y divide-line/70">
                {data.topProducts.map((product, index) => (
                  <li key={`${product.productId ?? product.name}-${index}`} className="px-5 py-3.5 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[0.625rem] font-bold text-accent-ink">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-semibold">
                          {product.productId ? (
                            <Link
                              href={`/products/${product.productId}`}
                              className="underline-offset-4 hover:text-primary-dark hover:underline"
                            >
                              {product.name}
                            </Link>
                          ) : (
                            product.name
                          )}
                        </p>
                        <p className="tabular mt-0.5 text-[0.6875rem] text-muted">
                          {formatMoney(product.revenueCents, context.shop.currency)}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-[0.75rem] font-bold">
                        {formatInteger(product.quantity)}
                        <span className="ml-1 text-[0.625rem] font-medium text-muted">
                          vendus
                        </span>
                      </span>
                    </div>
                    <ProgressBar
                      value={(product.quantity / maxTopQuantity) * 100}
                      tone="accent"
                      className="mt-2"
                      label={`${product.name} : ${formatInteger(product.quantity)} unités vendues`}
                    />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            title="À réapprovisionner"
            description={`Seuil atteint ou dépassé · ${warehouseName}.`}
            actions={
              <Link
                href="/products?stock=low"
                className="text-[0.75rem] font-bold text-primary-dark underline-offset-4 hover:underline"
              >
                Produits
              </Link>
            }
          >
            {data.lowStockProducts.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState
                  title="Stock sous contrôle"
                  body="Aucun produit n'est sous son seuil minimal dans cet entrepôt."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {data.lowStockProducts.map((product) => (
                  <li key={product.id} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                    <Avatar name={product.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8125rem] font-semibold">
                        <Link
                          href={`/products/${product.id}`}
                          className="underline-offset-4 hover:text-primary-dark hover:underline"
                        >
                          {product.name}
                        </Link>
                      </p>
                      <p className="tabular mt-0.5 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-muted">
                        {product.sku}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill tone={product.quantity <= 0 ? "danger" : "warning"}>
                        {product.quantity <= 0 ? "Rupture" : "Faible"}
                      </StatusPill>
                      <p className="tabular mt-1 font-mono text-[0.625rem] text-muted">
                        {formatInteger(product.quantity)} / {formatInteger(product.minStock)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

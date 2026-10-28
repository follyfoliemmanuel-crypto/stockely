import Link from "next/link";

import { PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { PrintButton } from "@/components/sales/print-button";
import { requirePage } from "@/server/auth/page";
import { getSalesReport } from "@/server/services/reports";
import { formatDate, formatInteger, formatMoney } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import { reportPresets, resolveReportRange } from "@/lib/report-range";
import { buildQuery, firstParam, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rapports" };

function buildDailySeries(
  from: string,
  to: string,
  daily: Array<{ day: string; revenue: number; count: number }>,
) {
  const values = new Map(daily.map((item) => [item.day, item]));
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const series: Array<{ day: string; revenue: number; count: number }> = [];

  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += 86_400_000) {
    const day = new Date(cursor).toISOString().slice(0, 10);
    series.push(values.get(day) ?? { day, revenue: 0, count: 0 });
  }

  return series;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("reports.read");
  const params = await searchParams;
  const range = resolveReportRange(
    firstParam(params.from),
    firstParam(params.to),
  );
  const report = await getSalesReport(
    context.shop.id,
    context.shop.timezone,
    range.from,
    range.to,
  );
  const presets = reportPresets();
  const canExport = context.permissions.has("reports.export");
  const currency = context.shop.currency;
  const series = buildDailySeries(range.from, range.to, report.daily);
  const maxRevenue = Math.max(1, ...series.map((item) => item.revenue));
  const paymentsTotal = report.payments.reduce((sum, item) => sum + item.amount, 0);
  const marginPercent =
    report.totals.revenue > 0
      ? (report.totals.margin / report.totals.revenue) * 100
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Analyse"
        title="Rapports"
        description="Ventes, marge, encaissements et valorisation du stock sur la période sélectionnée."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canExport && (
              <>
                <a
                  href={`/api/reports/export${buildQuery(
                    { from: range.from, to: range.to },
                    { type: "sales" },
                  )}`}
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  Ventes CSV
                </a>
                <a
                  href="/api/reports/export?type=inventory"
                  className={buttonClasses({ variant: "secondary", size: "sm" })}
                >
                  Stock CSV
                </a>
              </>
            )}
            <PrintButton label="Imprimer / PDF" />
          </div>
        }
      />

      <section className="print:hidden overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card">
        <form
          method="get"
          className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_9rem_auto_1fr] sm:items-end"
        >
          <div>
            <label htmlFor="from" className="text-[0.6875rem] font-medium text-muted">
              Du
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={range.from}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label htmlFor="to" className="text-[0.6875rem] font-medium text-muted">
              Au
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={range.to}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <button
            type="submit"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Actualiser
          </button>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {presets.map((preset) => {
              const active = preset.from === range.from && preset.to === range.to;
              return (
                <Link
                  key={preset.label}
                  href={`/reports${buildQuery({}, { from: preset.from, to: preset.to })}`}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
                    active
                      ? "border-primary/30 bg-primary-soft text-primary-dark"
                      : "border-line text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  {preset.label}
                </Link>
              );
            })}
          </div>
        </form>
        <p className="border-t border-line px-4 py-2 text-[0.6875rem] text-muted">
          {formatDate(range.from, context.shop.timezone)} —{" "}
          {formatDate(range.to, context.shop.timezone)}
        </p>
      </section>

      <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card sm:grid-cols-4 sm:divide-y-0">
        {[
          {
            label: "Chiffre d'affaires",
            value: formatMoney(report.totals.revenue, currency),
            hint: `${formatInteger(report.totals.count)} vente(s) terminée(s)`,
            tone: "default",
          },
          {
            label: "Panier moyen",
            value: formatMoney(report.totals.averageBasket, currency),
            hint: "Par vente terminée",
            tone: "default",
          },
          {
            label: "Marge brute",
            value: formatMoney(report.totals.margin, currency),
            hint:
              marginPercent !== null
                ? `${new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 1,
                  }).format(marginPercent)} % du CA`
                : "Aucune vente",
            tone: report.totals.margin < 0 ? "danger" : "default",
          },
          {
            label: "Remises accordées",
            value: formatMoney(report.totals.discount, currency),
            hint: `${formatMoney(report.totals.subtotal, currency)} de sous-total`,
            tone: "default",
          },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p
              className={cn(
                "tabular mt-1 font-mono text-lg font-medium",
                stat.tone === "danger" && "text-danger",
              )}
            >
              {stat.value}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Évolution du chiffre d'affaires"
        description="Ventes terminées par jour, dans le fuseau horaire de la boutique."
        actions={
          <span className="tabular font-mono text-[0.6875rem] text-muted">
            Max {formatMoney(maxRevenue, currency)}
          </span>
        }
      >
        {report.totals.count === 0 ? (
          <div className="p-4">
            <EmptyState
              compact
              title="Aucune vente sur la période"
              body="Ajustez les dates ou ouvrez la caisse pour enregistrer une vente."
              action={
                context.permissions.has("sales.create") ? (
                  <Link href="/sales/new" className={buttonClasses({ size: "sm" })}>
                    Ouvrir la caisse
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="px-5 py-5">
            <div className="flex h-36 items-end gap-1 overflow-x-auto">
              {series.map((item) => {
                const height =
                  item.revenue > 0
                    ? Math.max(4, Math.round((item.revenue / maxRevenue) * 100))
                    : 2;
                return (
                  <div
                    key={item.day}
                    className="group flex h-full min-w-2 flex-1 items-end"
                    title={`${formatDate(item.day, context.shop.timezone)} · ${formatMoney(
                      item.revenue,
                      currency,
                    )} · ${formatInteger(item.count)} vente(s)`}
                  >
                    <div
                      aria-label={`${item.day} : ${formatMoney(item.revenue, currency)}`}
                      className={cn(
                        "w-full rounded-t-sm transition-colors",
                        item.revenue > 0
                          ? "bg-primary/75 group-hover:bg-primary"
                          : "bg-surface-strong",
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[0.625rem] text-muted">
              <span>{formatDate(range.from, context.shop.timezone)}</span>
              <span>{formatDate(range.to, context.shop.timezone)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionCard
          title="Produits les plus vendus"
          description="Classement par chiffre d'affaires articles sur la période."
        >
          {report.topProducts.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                title="Aucun produit vendu"
                body="Les ventes terminées alimenteront ce classement."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full sm:min-w-[34rem] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                    <th className="px-4 py-2.5 font-semibold sm:px-5">Produit</th>
                    <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">
                      Qté
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold">CA</th>
                    <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell sm:px-5">
                      Marge
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.topProducts.map((product) => (
                    <tr key={`${product.sku}-${product.productName}`}>
                      <td className="px-4 py-3 sm:px-5">
                        {product.productId ? (
                          <Link
                            href={`/products/${product.productId}`}
                            className="font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                          >
                            {product.productName}
                          </Link>
                        ) : (
                          <span className="font-medium">{product.productName}</span>
                        )}
                        <span className="tabular mt-0.5 block font-mono text-[0.6875rem] text-muted">
                          {product.sku}
                        </span>
                      </td>
                      <td className="tabular hidden px-4 py-3 text-right font-mono sm:table-cell">
                        {formatInteger(product.quantity)}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-mono">
                        {formatMoney(product.revenue, currency)}
                      </td>
                      <td className="tabular hidden px-4 py-3 text-right font-mono sm:table-cell sm:px-5">
                        {product.complete ? (
                          formatMoney(product.margin, currency)
                        ) : (
                          <span className="text-[0.6875rem] text-muted">Coûts incomplets</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Encaissements">
            {report.payments.length === 0 ? (
              <div className="p-4">
                <EmptyState compact title="Aucun encaissement" body="Aucune vente terminée sur la période." />
              </div>
            ) : (
              <div className="space-y-3 px-5 py-4">
                {report.payments.map((payment) => {
                  const share =
                    paymentsTotal > 0 ? (payment.amount / paymentsTotal) * 100 : 0;
                  return (
                    <div key={payment.method}>
                      <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
                        <span className="font-medium">
                          {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                        </span>
                        <span className="tabular font-mono">
                          {formatMoney(payment.amount, currency)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-strong">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[0.625rem] text-muted">
                        {formatInteger(payment.count)} paiement(s) ·{" "}
                        {new Intl.NumberFormat("fr-FR", {
                          maximumFractionDigits: 1,
                        }).format(share)}{" "}
                        %
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Valorisation du stock"
            actions={
              <Link
                href="/stock"
                className="print:hidden text-[0.75rem] font-medium text-primary-dark underline-offset-2 hover:underline"
              >
                Détail
              </Link>
            }
          >
            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="px-4 py-3.5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
                  Valeur du stock
                </p>
                <p className="tabular mt-1 font-mono text-[1.05rem] font-medium">
                  {formatMoney(report.inventory.value, currency)}
                </p>
                <p className="mt-0.5 text-[0.625rem] text-muted">
                  {formatInteger(report.inventory.units)} unité(s) ·{" "}
                  {formatInteger(report.inventory.activeProducts)} référence(s) · tous
                  entrepôts
                </p>
              </div>
              <div className="px-4 py-3.5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-muted">
                  Alertes
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <StatusPill tone={report.inventory.outCount > 0 ? "danger" : "neutral"}>
                    {formatInteger(report.inventory.outCount)} rupture(s)
                  </StatusPill>
                  <StatusPill tone={report.inventory.lowCount > 0 ? "warning" : "neutral"}>
                    {formatInteger(report.inventory.lowCount)} faible(s)
                  </StatusPill>
                </div>
              </div>
            </div>
            {report.lowStock.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {report.lowStock.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link
                      href={`/products/${product.id}`}
                      className="min-w-0 truncate text-[0.75rem] font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span
                      className={cn(
                        "tabular shrink-0 font-mono text-[0.75rem]",
                        product.quantity <= 0 ? "text-danger" : "text-warning",
                      )}
                    >
                      {formatInteger(product.quantity)} / {formatInteger(product.minStock)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>

      <p className="text-[0.6875rem] text-muted">
        Les exports CSV sont journalisés dans le journal d&apos;audit.{" "}
        <Link
          href="/audit"
          className="print:hidden font-medium underline underline-offset-2"
        >
          Consulter le journal d&apos;audit
        </Link>
      </p>
    </div>
  );
}

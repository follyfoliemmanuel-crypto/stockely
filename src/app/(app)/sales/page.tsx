import Link from "next/link";

import { PageHeader, EmptyState, Pagination, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import {
  getSalesStats,
  listSales,
  type SalesListFilters,
} from "@/server/services/sales";
import { formatDate, formatInteger, formatMoney } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
} from "@/lib/labels";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ventes" };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("sales.read");
  const params = await searchParams;

  const q = firstParam(params.q)?.trim() ?? "";
  const status = (firstParam(params.status) ?? "all") as SalesListFilters["status"];
  const from = firstParam(params.from) ?? "";
  const to = firstParam(params.to) ?? "";
  const page = pageParam(params.page);

  const [result, stats] = await Promise.all([
    listSales(context.shop.id, {
      q: q || undefined,
      status,
      from: from || undefined,
      to: to || undefined,
      page,
    }),
    getSalesStats(context.shop.id, context.shop.timezone),
  ]);

  const canSell = context.permissions.has("sales.create");
  const current = {
    q: q || undefined,
    status: status === "all" ? undefined : status,
    from: from || undefined,
    to: to || undefined,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Opérations"
        title="Ventes"
        description="Tickets, encaissements et annulations de la boutique active."
        actions={
          canSell ? (
            <Link href="/sales/new" className={buttonClasses({ size: "sm" })}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Nouvelle vente
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Ventes aujourd'hui", value: formatInteger(stats.todayCount) },
          {
            label: "Encaissé aujourd'hui",
            value: formatMoney(stats.todayRevenue, context.shop.currency),
          },
          { label: "Ventes ce mois", value: formatInteger(stats.monthCount) },
          {
            label: "CA du mois",
            value: formatMoney(stats.monthRevenue, context.shop.currency),
          },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p className="tabular mt-1 font-mono text-lg font-medium">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card">
        <form
          method="get"
          className="grid gap-2 border-b border-line bg-surface/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_9rem_auto] sm:items-end"
        >
          <div>
            <label htmlFor="q" className="text-[0.6875rem] font-medium text-muted">
              Rechercher
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="N° de vente ou client"
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-3 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label htmlFor="status" className="text-[0.6875rem] font-medium text-muted">
              Statut
            </label>
            <select
              id="status"
              name="status"
              defaultValue={status}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="all">Toutes</option>
              <option value="completed">Terminées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>
          <div>
            <label htmlFor="from" className="text-[0.6875rem] font-medium text-muted">
              Du
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={from}
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
              defaultValue={to}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Filtrer
            </button>
            {(q || status !== "all" || from || to) && (
              <Link
                href="/sales"
                className="text-[0.75rem] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Réinitialiser
              </Link>
            )}
          </div>
        </form>

        {result.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q || from || to || status !== "all" ? "Aucune vente trouvée" : "Aucune vente pour l'instant"}
              body={
                q || from || to || status !== "all"
                  ? "Élargissez la période ou retirez les filtres."
                  : "Les ventes encaissées depuis la caisse apparaîtront ici."
              }
              action={
                canSell && !q && !from && !to && status === "all" ? (
                  <Link href="/sales/new" className={buttonClasses({ size: "sm" })}>
                    Ouvrir la caisse
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full lg:min-w-[56rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Vente</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Date</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Client</th>
                  <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Entrepôt</th>
                  <th className="hidden px-4 py-2.5 text-right font-semibold sm:table-cell">
                    Articles
                  </th>
                  <th className="hidden px-4 py-2.5 font-semibold xl:table-cell">Paiement</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Statut</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="hidden w-8 px-2 py-2.5 sm:table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((sale) => (
                  <tr key={sale.id} className="group transition-colors hover:bg-surface/60">
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/sales/${sale.id}`}
                        className="tabular font-mono text-[0.75rem] font-medium group-hover:text-primary-dark"
                      >
                        {sale.number}
                      </Link>
                      <span className="mt-0.5 block max-w-[10rem] truncate text-[0.75rem] text-muted md:hidden">
                        {sale.customerName ?? "Client de passage"}
                      </span>
                      <span className="tabular mt-0.5 block whitespace-nowrap font-mono text-[0.625rem] text-muted sm:hidden">
                        {formatDate(sale.createdAt, context.shop.timezone, true)}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-muted sm:table-cell">
                      {formatDate(sale.createdAt, context.shop.timezone, true)}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {sale.customerName ?? <span className="text-muted">Passage</span>}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      {sale.warehouseName ? (
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="max-w-[9rem] truncate">{sale.warehouseName}</span>
                          <span className="font-mono text-[0.625rem] text-muted">
                            {sale.warehouseCode}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="tabular hidden px-4 py-3 text-right font-mono sm:table-cell">
                      {formatInteger(Number(sale.itemCount))}
                    </td>
                    <td className="hidden px-4 py-3 text-muted xl:table-cell">
                      {sale.paymentMethod
                        ? (PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod)
                        : "—"}
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusPill tone={sale.status === "completed" ? "success" : "danger"}>
                        {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                      </StatusPill>
                    </td>
                    <td className="tabular px-4 py-3 text-right font-mono font-medium">
                      {formatMoney(sale.totalCents, context.shop.currency)}
                      <span className="mt-1 flex justify-end sm:hidden">
                        <StatusPill tone={sale.status === "completed" ? "success" : "danger"}>
                          {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                        </StatusPill>
                      </span>
                    </td>
                    <td className="hidden px-2 py-3 text-right sm:table-cell">
                      <Link
                        href={`/sales/${sale.id}`}
                        aria-label={`Voir la vente ${sale.number}`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
                      >
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                          <path
                            d="m8 5 5 5-5 5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          prevHref={
            result.page > 1 ? `/sales${buildQuery(current, { page: result.page - 1 })}` : null
          }
          nextHref={
            result.page < result.pageCount
              ? `/sales${buildQuery(current, { page: result.page + 1 })}`
              : null
          }
        />
      </section>
    </div>
  );
}

import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import {
  Avatar,
  KpiCard,
  ProgressBar,
} from "@/components/ui/metrics";
import {
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  StatusPill,
} from "@/components/ui/page";
import { formatDate, formatInteger, formatMoney } from "@/lib/money";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";
import { requirePage } from "@/server/auth/page";
import { getCustomerStats, listCustomers } from "@/server/services/customers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("customers.read");
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const page = pageParam(params.page);

  const [result, stats] = await Promise.all([
    listCustomers(context.shop.id, { q: q || undefined, page }),
    getCustomerStats(context.shop.id, context.shop.timezone),
  ]);

  const canWrite = context.permissions.has("customers.write");
  const currency = context.shop.currency;
  const activePct =
    stats.totalCustomers > 0
      ? (stats.activeCustomers / stats.totalCustomers) * 100
      : 0;
  const totalRevenue =
    stats.identifiedRevenueCents + stats.walkInRevenueCents;
  const identifiedPct =
    totalRevenue > 0
      ? (stats.identifiedRevenueCents / totalRevenue) * 100
      : 0;
  const topSpend = Math.max(
    1,
    ...stats.topCustomers.map((customer) => customer.spentCents),
  );

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Contacts"
        title="Clients"
        description="Fiches clients, historique d'achats et chiffre d'affaires rattaché à la boutique active."
        actions={
          canWrite ? (
            <Link href="/customers/new" className={buttonClasses({ size: "sm" })}>
              <span aria-hidden="true" className="text-base leading-none">+</span>
              Nouveau client
            </Link>
          ) : null
        }
      />

      <section aria-label="Indicateurs clients">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total clients"
            value={formatInteger(stats.totalCustomers)}
            hint="Fiches enregistrées dans la boutique."
            icon="users"
            tone="primary"
          />
          <KpiCard
            label="Clients actifs"
            value={formatInteger(stats.activeCustomers)}
            hint={`${Math.round(activePct)} % des fiches ont déjà acheté.`}
            icon="users"
            tone="accent"
            footer={
              <div>
                <div className="flex items-center justify-between text-[0.625rem] font-semibold text-muted">
                  <span>Taux d&apos;activation</span>
                  <span className="tabular">{Math.round(activePct)} %</span>
                </div>
                <ProgressBar
                  value={activePct}
                  tone="accent"
                  className="mt-1.5"
                  label="Part des clients ayant déjà acheté"
                />
              </div>
            }
          />
          <KpiCard
            label="Nouveaux ce mois"
            value={formatInteger(stats.newThisMonth)}
            hint="Fiches créées depuis le début du mois."
            icon="user-plus"
            tone="info"
          />
          <KpiCard
            label="CA clients"
            value={formatMoney(stats.identifiedRevenueCents, currency)}
            hint={`${formatInteger(stats.activeCustomers)} client${stats.activeCustomers > 1 ? "s" : ""} identifié${stats.activeCustomers > 1 ? "s" : ""} · ${formatInteger(stats.completedSalesCount)} ventes`}
            icon="wallet"
            tone="primary"
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <SectionCard
          title="Répertoire clients"
          description={`${formatInteger(result.total)} fiche${result.total > 1 ? "s" : ""} client${result.total > 1 ? "s" : ""}.`}
          className="min-w-0"
        >
          <form
            method="get"
            className="flex flex-col gap-3 border-b border-line/80 bg-surface/60 px-4 py-4 sm:flex-row sm:items-end sm:px-5"
          >
            <div className="flex-1">
              <label htmlFor="q" className="text-[0.6875rem] font-bold text-muted">
                Rechercher un client
              </label>
              <div className="relative">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Nom, téléphone ou e-mail"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[0.8125rem] text-ink shadow-soft outline-none placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Rechercher
              </button>
              {q && (
                <Link
                  href="/customers"
                  className="text-[0.75rem] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  Réinitialiser
                </Link>
              )}
            </div>
          </form>

          {result.items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={q ? "Aucun client trouvé" : "Aucun client pour l'instant"}
                body={
                  q
                    ? "Essayez un autre nom, numéro ou adresse e-mail."
                    : "Créez une fiche client pour rattacher les ventes et suivre les achats."
                }
                action={
                  canWrite && !q ? (
                    <Link href="/customers/new" className={buttonClasses({ size: "sm" })}>
                      Créer un client
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table xl:min-w-[38rem]">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold sm:px-5 md:px-6">
                      Client
                    </th>
                    <th scope="col" className="hidden px-5 py-3 font-bold md:table-cell">
                      Contact
                    </th>
                    <th scope="col" className="hidden px-5 py-3 text-right font-bold sm:table-cell">
                      Achats
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold sm:px-5">
                      Total dépensé
                    </th>
                    <th scope="col" className="hidden whitespace-nowrap px-5 py-3 font-bold xl:table-cell">
                      Depuis
                    </th>
                    <th scope="col" className="hidden w-10 px-3 py-3 sm:table-cell">
                      <span className="sr-only">Ouvrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {result.items.map((customer) => (
                    <tr key={customer.id} className="group">
                      <td className="px-4 py-3 sm:px-5 md:px-6">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={customer.name} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold group-hover:text-primary-dark">
                              {customer.name}
                            </span>
                            {customer.address && (
                              <span className="mt-0.5 block max-w-56 truncate text-[0.6875rem] text-muted">
                                {customer.address}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-5 py-3 text-muted md:table-cell">
                        <span className="block">{customer.phone ?? "—"}</span>
                        {customer.email && (
                          <span className="block max-w-48 truncate text-[0.6875rem]">
                            {customer.email}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-5 py-3 text-right sm:table-cell">
                        <StatusPill tone={customer.salesCount > 0 ? "success" : "neutral"}>
                          {formatInteger(customer.salesCount)}
                        </StatusPill>
                      </td>
                      <td className="tabular px-4 py-3 text-right font-mono font-semibold sm:px-5">
                        {formatMoney(customer.spentCents, currency)}
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3 text-[0.75rem] text-muted xl:table-cell">
                        {formatDate(customer.createdAt, context.shop.timezone)}
                      </td>
                      <td className="hidden px-3 py-3 text-right sm:table-cell">
                        <Link
                          href={`/customers/${customer.id}`}
                          aria-label={`Voir ${customer.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
                        >
                          <Icon name="arrow-right" className="h-4 w-4" />
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
              result.page > 1
                ? `/customers${buildQuery({ q: q || undefined }, { page: result.page - 1 })}`
                : null
            }
            nextHref={
              result.page < result.pageCount
                ? `/customers${buildQuery({ q: q || undefined }, { page: result.page + 1 })}`
                : null
            }
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Meilleurs clients"
            description="Classement par chiffre d'affaires rattaché."
          >
            {stats.topCustomers.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Pas encore de classement"
                  body="Les clients apparaîtront ici dès qu'une vente leur sera rattachée."
                />
              </div>
            ) : (
              <ol className="divide-y divide-line/70">
                {stats.topCustomers.map((customer, index) => (
                  <li key={customer.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[0.5625rem] font-bold text-accent-ink">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Avatar name={customer.name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.75rem] font-semibold">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="underline-offset-4 hover:text-primary-dark hover:underline"
                          >
                            {customer.name}
                          </Link>
                        </p>
                        <p className="tabular mt-0.5 text-[0.625rem] text-muted">
                          {formatInteger(customer.salesCount)} achat
                          {customer.salesCount > 1 ? "s" : ""}
                          {customer.lastSaleAt
                            ? ` · ${formatDate(customer.lastSaleAt, context.shop.timezone)}`
                            : ""}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-[0.6875rem] font-bold">
                        {formatMoney(customer.spentCents, currency)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(customer.spentCents / topSpend) * 100}
                      tone="accent"
                      className="mt-2"
                      label={`${customer.name} : ${formatMoney(customer.spentCents, currency)}`}
                    />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard
            title="Origine des ventes"
            description="Chiffre d'affaires des ventes encaissées."
          >
            {totalRevenue === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Aucune vente encaissée"
                  body="La répartition entre clients identifiés et ventes de passage apparaîtra ici."
                />
              </div>
            ) : (
              <div className="space-y-5 px-5 pb-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[0.75rem] font-semibold">
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-primary" />
                      Clients identifiés
                    </span>
                    <span className="tabular text-[0.75rem] font-bold">
                      {formatMoney(stats.identifiedRevenueCents, currency)}
                    </span>
                  </div>
                  <ProgressBar
                    value={identifiedPct}
                    tone="primary"
                    className="mt-2"
                    label={`Clients identifiés : ${Math.round(identifiedPct)} % du chiffre d'affaires`}
                  />
                  <p className="mt-1 text-[0.625rem] text-muted">
                    {Math.round(identifiedPct)} % du chiffre d&apos;affaires
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[0.75rem] font-semibold">
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-accent-strong" />
                      Client de passage
                    </span>
                    <span className="tabular text-[0.75rem] font-bold">
                      {formatMoney(stats.walkInRevenueCents, currency)}
                    </span>
                  </div>
                  <ProgressBar
                    value={100 - identifiedPct}
                    tone="accent"
                    className="mt-2"
                    label={`Client de passage : ${Math.round(100 - identifiedPct)} % du chiffre d'affaires`}
                  />
                  <p className="mt-1 text-[0.625rem] text-muted">
                    {Math.round(100 - identifiedPct)} % du chiffre d&apos;affaires
                  </p>
                </div>

                <div className="rounded-xl bg-surface/80 px-3 py-2.5 text-[0.6875rem] leading-5 text-muted">
                  <strong className="font-semibold text-ink">
                    {formatInteger(stats.completedSalesCount)} ventes encaissées
                  </strong>{" "}
                  sur la période disponible, dont {formatInteger(stats.activeCustomers)}{" "}
                  client{stats.activeCustomers > 1 ? "s" : ""} identifié
                  {stats.activeCustomers > 1 ? "s" : ""}.
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

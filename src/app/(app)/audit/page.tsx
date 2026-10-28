import Link from "next/link";

import { PageHeader, EmptyState, Pagination, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { getAuditStats, listAuditLogs } from "@/server/services/audit";
import { formatDate, formatInteger } from "@/lib/money";
import {
  AUDIT_ENTITY_LABELS,
  auditActionLabel,
} from "@/lib/labels";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Journal d'audit" };

function actionTone(action: string): "success" | "danger" | "warning" | "info" | "neutral" {
  if (action.includes("cancelled") || action.includes("deleted")) return "danger";
  if (action.includes("created") || action.includes("login") || action.includes("restored")) {
    return "success";
  }
  if (action.startsWith("stock.")) return "info";
  return "neutral";
}

function entityHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "sale":
      return `/sales/${entityId}`;
    case "product":
      return `/products/${entityId}`;
    case "customer":
      return `/customers/${entityId}`;
    case "supplier":
      return `/suppliers/${entityId}/edit`;
    case "category":
      return "/categories";
    default:
      return null;
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("audit.read");
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const from = firstParam(params.from) ?? "";
  const to = firstParam(params.to) ?? "";
  const page = pageParam(params.page);

  const [result, stats] = await Promise.all([
    listAuditLogs(
      context.shop.id,
      {
        q: q || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
      },
      context.shop.timezone,
    ),
    getAuditStats(context.shop.id, context.shop.timezone),
  ]);

  const current = {
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sécurité"
        title="Journal d'audit"
        description="Historique en ajout seul des connexions, ventes, annulations, mouvements de stock et modifications du catalogue."
      />

      <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Événements aujourd'hui", value: formatInteger(stats.today) },
          { label: "Total conservé", value: formatInteger(stats.total) },
          { label: "Ventes annulées", value: formatInteger(stats.cancelledSales) },
          { label: "Mouvements de stock", value: formatInteger(stats.stockEvents) },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p className="tabular mt-1 font-mono text-xl font-medium">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card">
        <form
          method="get"
          className="grid gap-2 border-b border-line bg-surface/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] sm:items-end"
        >
          <div>
            <label htmlFor="q" className="text-[0.6875rem] font-medium text-muted">
              Rechercher
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Action, utilisateur, identifiant…"
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-3 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
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
            {(q || from || to) && (
              <Link
                href="/audit"
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
              title={q || from || to ? "Aucun événement trouvé" : "Aucun événement journalisé"}
              body={
                q || from || to
                  ? "Élargissez la période ou modifiez la recherche."
                  : "Les actions sensibles apparaîtront ici automatiquement."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full lg:min-w-[52rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="hidden px-5 py-2.5 font-semibold sm:table-cell">Date</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Action</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Objet</th>
                  <th className="hidden px-4 py-2.5 font-semibold lg:table-cell">Utilisateur</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((entry) => {
                  const href = entityHref(entry.entityType, entry.entityId);
                  const entityLabel = entry.entityType
                    ? (AUDIT_ENTITY_LABELS[entry.entityType] ?? entry.entityType)
                    : null;
                  return (
                    <tr key={entry.id} className="align-top transition-colors hover:bg-surface/50">
                      <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">
                        {formatDate(entry.createdAt, context.shop.timezone, true)}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <StatusPill tone={actionTone(entry.action)}>
                          {auditActionLabel(entry.action)}
                        </StatusPill>
                        <span className="tabular mt-1 block whitespace-nowrap font-mono text-[0.625rem] text-muted sm:hidden">
                          {formatDate(entry.createdAt, context.shop.timezone, true)}
                        </span>
                        <span className="tabular mt-1 block font-mono text-[0.625rem] text-muted">
                          {entry.action}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {entityLabel ? (
                          href ? (
                            <Link
                              href={href}
                              className="font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                            >
                              {entityLabel}
                            </Link>
                          ) : (
                            <span className="font-medium">{entityLabel}</span>
                          )
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {entry.entityId && (
                          <span className="tabular mt-0.5 block max-w-44 truncate font-mono text-[0.625rem] text-muted">
                            {entry.entityId}
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span className="block font-medium">
                          {entry.userName ?? "Système"}
                        </span>
                        {entry.userEmail && (
                          <span className="block max-w-44 truncate text-[0.625rem] text-muted">
                            {entry.userEmail}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-[0.75rem] font-medium text-muted hover:text-ink">
                              Voir
                            </summary>
                            <pre className="mt-1.5 max-w-xs overflow-x-auto rounded-md bg-surface p-2 text-[0.625rem] leading-5 text-muted">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-[0.75rem] text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={result.page}
          pageCount={result.pageCount}
          prevHref={
            result.page > 1 ? `/audit${buildQuery(current, { page: result.page - 1 })}` : null
          }
          nextHref={
            result.page < result.pageCount
              ? `/audit${buildQuery(current, { page: result.page + 1 })}`
              : null
          }
        />
      </section>

      <p className="text-[0.6875rem] text-muted">
        Le journal est protégé en base : les mises à jour, suppressions et
        troncatures sont bloquées par des triggers PostgreSQL.
      </p>
    </div>
  );
}

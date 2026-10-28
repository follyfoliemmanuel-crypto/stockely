import Link from "next/link";

import { PageHeader, EmptyState, Pagination } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { TransferStatusBadge } from "@/components/transfers/transfer-status-badge";
import { requirePage } from "@/server/auth/page";
import { listTransfers } from "@/server/services/transfers";
import { formatDate, formatInteger } from "@/lib/money";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";
import type { TransferStatus } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export const metadata = { title: "Transferts de stock" };

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("transfers.read");
  const params = await searchParams;

  const q = firstParam(params.q)?.trim() ?? "";
  const statusParam = firstParam(params.status);
  const status =
    statusParam && ["prepared", "shipped", "received", "cancelled"].includes(statusParam)
      ? (statusParam as TransferStatus)
      : undefined;
  const warehouseId = firstParam(params.warehouseId) ?? "";
  const page = pageParam(params.page);

  const result = await listTransfers(context, {
    q: q || undefined,
    status,
    warehouseId: warehouseId || undefined,
    page,
  });

  const canCreate = context.permissions.has("transfers.create");
  const current = {
    q: q || undefined,
    status,
    warehouseId: warehouseId || undefined,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Opérations"
          title="Transferts inter-entrepôts"
          description="Acheminez des marchandises entre vos différents points de vente et entrepôts avec traçabilité complète."
        />
        {canCreate && (
          <Link
            href="/transfers/new"
            className={buttonClasses({ variant: "primary" })}
          >
            Nouveau transfert
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
        <Link
          href={`/transfers${buildQuery(current, { status: undefined, page: undefined })}`}
          className={buttonClasses({
            variant: !status ? "primary" : "secondary",
            size: "sm",
          })}
        >
          Tous
        </Link>
        <Link
          href={`/transfers${buildQuery(current, { status: "prepared", page: undefined })}`}
          className={buttonClasses({
            variant: status === "prepared" ? "primary" : "secondary",
            size: "sm",
          })}
        >
          Préparés
        </Link>
        <Link
          href={`/transfers${buildQuery(current, { status: "shipped", page: undefined })}`}
          className={buttonClasses({
            variant: status === "shipped" ? "primary" : "secondary",
            size: "sm",
          })}
        >
          En transit (Expédiés)
        </Link>
        <Link
          href={`/transfers${buildQuery(current, { status: "received", page: undefined })}`}
          className={buttonClasses({
            variant: status === "received" ? "primary" : "secondary",
            size: "sm",
          })}
        >
          Reçus
        </Link>
        <Link
          href={`/transfers${buildQuery(current, { status: "cancelled", page: undefined })}`}
          className={buttonClasses({
            variant: status === "cancelled" ? "primary" : "secondary",
            size: "sm",
          })}
        >
          Annulés
        </Link>
      </div>

      {/* Tableau des transferts */}
      {result.items.length === 0 ? (
        <EmptyState
          title="Aucun transfert trouvé"
          body={
            status || q || warehouseId
              ? "Aucun transfert ne correspond à vos critères de recherche."
              : "Créez votre premier transfert pour déplacer du stock entre vos entrepôts."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-xs">
          <table className="data-table md:min-w-[48rem]">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 sm:px-5">
                  Numéro
                </th>
                <th scope="col" className="hidden px-4 py-3 sm:table-cell">
                  Statut
                </th>
                <th scope="col" className="px-4 py-3">
                  Itinéraire
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right lg:table-cell">
                  Articles
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Quantité
                </th>
                <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                  Date
                </th>
                <th scope="col" className="hidden px-4 py-3 text-right sm:table-cell">
                  Détails
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.items.map((trf) => (
                <tr key={trf.id}>
                  <td className="px-4 py-3 font-mono font-medium text-ink sm:px-5">
                    <Link
                      href={`/transfers/${trf.id}`}
                      className="tabular text-[0.75rem] text-primary-dark underline-offset-4 hover:underline"
                    >
                      {trf.number}
                    </Link>
                    <span className="mt-1 block sm:hidden">
                      <TransferStatusBadge status={trf.status} />
                    </span>
                    <span className="mt-1 block whitespace-nowrap text-[0.625rem] text-muted sm:hidden">
                      {formatDate(trf.createdAt, context.shop.timezone)}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <TransferStatusBadge status={trf.status} />
                  </td>
                  <td className="px-4 py-3 text-ink">
                    <span className="block max-w-[11rem] truncate text-[0.8125rem] font-medium sm:max-w-none">
                      {trf.fromWarehouseName}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-1 text-[0.75rem] text-muted">
                      <span aria-hidden="true">→</span>
                      <span className="truncate">{trf.toWarehouseName}</span>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-right font-mono text-muted lg:table-cell">
                    {formatInteger(trf.itemCount)} réf.
                  </td>
                  <td className="tabular px-4 py-3 text-right font-mono font-medium text-ink">
                    {formatInteger(trf.totalQuantitySent)}{" "}
                    unité{trf.totalQuantitySent > 1 ? "s" : ""}
                    {trf.totalQuantityReceived !== null &&
                      trf.totalQuantityReceived < trf.totalQuantitySent && (
                        <span className="block text-[0.6875rem] text-danger">
                          ({formatInteger(trf.totalQuantityReceived)} reçue
                          {trf.totalQuantityReceived > 1 ? "s" : ""})
                        </span>
                      )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-[0.75rem] text-muted lg:table-cell">
                    {formatDate(trf.createdAt, context.shop.timezone)}
                  </td>
                  <td className="hidden px-4 py-3 text-right sm:table-cell">
                    <Link
                      href={`/transfers/${trf.id}`}
                      className={buttonClasses({ variant: "secondary", size: "sm" })}
                    >
                      Consulter
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
            ? `/transfers${buildQuery(current, { page: result.page - 1 })}`
            : null
        }
        nextHref={
          result.page < result.pageCount
            ? `/transfers${buildQuery(current, { page: result.page + 1 })}`
            : null
        }
      />
    </div>
  );
}

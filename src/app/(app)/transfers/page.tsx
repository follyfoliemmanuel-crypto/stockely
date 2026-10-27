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

  const result = await listTransfers(context.shop.id, {
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
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
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
        <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-subtle text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Itinéraire</th>
                <th className="px-4 py-3 text-right">Articles</th>
                <th className="px-4 py-3 text-right">Quantité</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.items.map((trf) => (
                <tr key={trf.id} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-foreground">
                    <Link
                      href={`/transfers/${trf.id}`}
                      className="text-primary hover:underline"
                    >
                      {trf.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <TransferStatusBadge status={trf.status} />
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    <span className="font-medium">{trf.fromWarehouseName}</span>
                    <span className="text-muted mx-1.5">➔</span>
                    <span className="font-medium">{trf.toWarehouseName}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {trf.itemCount} réf.
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">
                    {formatInteger(trf.totalQuantitySent)} unités
                    {trf.totalQuantityReceived !== null &&
                      trf.totalQuantityReceived < trf.totalQuantitySent && (
                        <span className="block text-xs text-danger">
                          ({formatInteger(trf.totalQuantityReceived)} reçues)
                        </span>
                      )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {formatDate(trf.createdAt, context.shop.timezone)}
                  </td>
                  <td className="px-4 py-3 text-right">
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

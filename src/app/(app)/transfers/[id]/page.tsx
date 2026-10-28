import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionCard } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { TransferStatusBadge } from "@/components/transfers/transfer-status-badge";
import { TransferActions } from "@/components/transfers/transfer-actions";
import { requirePage } from "@/server/auth/page";
import { getTransfer } from "@/server/services/transfers";
import { formatDate, formatInteger } from "@/lib/money";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return { title: `Transfert ${id}` };
}

export default async function TransferDetailPage({ params }: PageProps) {
  const context = await requirePage("transfers.read");
  const { id } = await params;

  const transfer = await getTransfer(context.shop.id, id);
  if (!transfer) notFound();

  const canShip = context.permissions.has("transfers.ship");
  const canReceive = context.permissions.has("transfers.receive");
  const canCancel = context.permissions.has("transfers.cancel");

  const totalSent = transfer.items.reduce((sum, i) => sum + i.quantitySent, 0);
  const totalReceived = transfer.items.reduce(
    (sum, i) => sum + (i.quantityReceived ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              {transfer.number}
            </h1>
            <TransferStatusBadge status={transfer.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            Créé le {formatDate(transfer.createdAt, context.shop.timezone)}
            {transfer.createdBy && ` par ${transfer.createdBy.name}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/transfers"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Retour aux transferts
          </Link>
        </div>
      </div>

      {/* Barre d'actions contextuelles */}
      <TransferActions
        transfer={transfer}
        canShip={canShip}
        canReceive={canReceive}
        canCancel={canCancel}
      />

      {/* Résumé de l'itinéraire & Chronologie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SectionCard title="Itinéraire">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
              <span className="shrink-0 text-muted">Origine (Départ)</span>
              <span className="min-w-0 truncate text-right font-semibold text-ink">
                {transfer.fromWarehouse.name} ({transfer.fromWarehouse.code})
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
              <span className="shrink-0 text-muted">Destination (Arrivée)</span>
              <span className="min-w-0 truncate text-right font-semibold text-ink">
                {transfer.toWarehouse.name} ({transfer.toWarehouse.code})
              </span>
            </div>
            {transfer.note && (
              <div className="pt-1">
                <span className="text-xs font-medium text-muted">Note :</span>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-ink bg-surface-strong p-2.5 rounded-lg border border-line">
                  {transfer.note}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Chronologie & Responsabilités">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-line/60 pb-2">
              <span className="text-muted">Préparé le</span>
              <span className="text-ink">
                {formatDate(transfer.createdAt, context.shop.timezone)}
              </span>
            </div>
            {transfer.shippedAt && (
              <div className="flex items-center justify-between border-b border-line/60 pb-2">
                <span className="text-muted">Expédié le</span>
                <span className="text-ink">
                  {formatDate(transfer.shippedAt, context.shop.timezone)}
                  {transfer.shippedBy && ` (${transfer.shippedBy.name})`}
                </span>
              </div>
            )}
            {transfer.receivedAt && (
              <div className="flex items-center justify-between border-b border-line/60 pb-2">
                <span className="text-muted">Réceptionné le</span>
                <span className="text-ink">
                  {formatDate(transfer.receivedAt, context.shop.timezone)}
                  {transfer.receivedBy && ` (${transfer.receivedBy.name})`}
                </span>
              </div>
            )}
            {transfer.cancelledAt && (
              <div className="border-b border-line/60 pb-2 text-danger">
                <div className="flex items-center justify-between">
                  <span>Annulé le</span>
                  <span>{formatDate(transfer.cancelledAt, context.shop.timezone)}</span>
                </div>
                {transfer.cancelReason && (
                  <p className="mt-1 text-xs text-muted">
                    Motif : {transfer.cancelReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Lignes du transfert */}
      <SectionCard
        title={`Articles transférés (${transfer.items.length} référence${
          transfer.items.length > 1 ? "s" : ""
        })`}
        description={`Total expédié : ${formatInteger(totalSent)} unité${
          totalSent > 1 ? "s" : ""
        }${
          transfer.status === "received"
            ? ` · Total reçu : ${formatInteger(totalReceived)} unité${
                totalReceived > 1 ? "s" : ""
              }`
            : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full md:min-w-[34rem] text-left text-[0.8125rem]">
            <thead className="bg-surface-strong text-[0.625rem] font-bold uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="hidden px-4 py-3 sm:table-cell">SKU</th>
                <th className="px-4 py-3 text-right">Quantité expédiée</th>
                {transfer.status === "received" && (
                  <>
                    <th className="px-4 py-3 text-right">Quantité reçue</th>
                    <th className="hidden px-4 py-3 md:table-cell">Écart / Observation</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transfer.items.map((item) => {
                const isLoss =
                  item.quantityReceived !== null &&
                  item.quantityReceived < item.quantitySent;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-ink">
                      {item.productName}
                      <span className="tabular mt-0.5 block font-mono text-[0.6875rem] text-muted sm:hidden">
                        {item.sku}
                      </span>
                    </td>
                    <td className="tabular hidden px-4 py-3 font-mono text-[0.75rem] text-muted sm:table-cell">
                      {item.sku}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-mono font-medium text-ink">
                      {formatInteger(item.quantitySent)}
                    </td>
                    {transfer.status === "received" && (
                      <>
                        <td className="tabular px-4 py-3 text-right font-mono font-semibold text-ink">
                          {formatInteger(item.quantityReceived ?? 0)}
                          <span className="mt-0.5 block md:hidden">
                            {isLoss ? (
                              <span className="text-[0.625rem] font-normal text-danger">
                                -{formatInteger(item.quantitySent - (item.quantityReceived ?? 0))}
                              </span>
                            ) : (
                              <span className="text-[0.625rem] font-normal text-primary-dark">
                                conforme
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-[0.75rem] md:table-cell">
                          {isLoss ? (
                            <span className="font-medium text-danger">
                              -
                              {formatInteger(
                                item.quantitySent - (item.quantityReceived ?? 0),
                              )}{" "}
                              manquant ({item.discrepancyReason || "Non précisé"})
                            </span>
                          ) : (
                            <span className="font-medium text-primary-dark">Conforme</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

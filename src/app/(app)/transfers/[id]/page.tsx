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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted">Origine (Départ)</span>
              <span className="font-semibold text-foreground">
                {transfer.fromWarehouse.name} ({transfer.fromWarehouse.code})
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted">Destination (Arrivée)</span>
              <span className="font-semibold text-foreground">
                {transfer.toWarehouse.name} ({transfer.toWarehouse.code})
              </span>
            </div>
            {transfer.note && (
              <div className="pt-1">
                <span className="text-xs font-medium text-muted">Note :</span>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground bg-surface-subtle p-2.5 rounded-lg border border-border">
                  {transfer.note}
                </p>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Chronologie & Responsabilités">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted">Préparé le</span>
              <span className="text-foreground">
                {formatDate(transfer.createdAt, context.shop.timezone)}
              </span>
            </div>
            {transfer.shippedAt && (
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted">Expédié le</span>
                <span className="text-foreground">
                  {formatDate(transfer.shippedAt, context.shop.timezone)}
                  {transfer.shippedBy && ` (${transfer.shippedBy.name})`}
                </span>
              </div>
            )}
            {transfer.receivedAt && (
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-muted">Réceptionné le</span>
                <span className="text-foreground">
                  {formatDate(transfer.receivedAt, context.shop.timezone)}
                  {transfer.receivedBy && ` (${transfer.receivedBy.name})`}
                </span>
              </div>
            )}
            {transfer.cancelledAt && (
              <div className="border-b border-border/60 pb-2 text-danger">
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
        title={`Articles transférés (${transfer.items.length} références)`}
        description={`Total expédié : ${formatInteger(totalSent)} unités${
          transfer.status === "received"
            ? ` · Total reçu : ${formatInteger(totalReceived)} unités`
            : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-subtle text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Produit</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Quantité expédiée</th>
                {transfer.status === "received" && (
                  <>
                    <th className="px-4 py-3 text-right">Quantité reçue</th>
                    <th className="px-4 py-3">Écart / Observation</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfer.items.map((item) => {
                const isLoss =
                  item.quantityReceived !== null &&
                  item.quantityReceived < item.quantitySent;
                return (
                  <tr key={item.id} className="hover:bg-surface-subtle/50">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {item.productName}
                    </td>
                    <td className="px-4 py-3 text-muted">{item.sku}</td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatInteger(item.quantitySent)}
                    </td>
                    {transfer.status === "received" && (
                      <>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatInteger(item.quantityReceived ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {isLoss ? (
                            <span className="text-danger font-medium">
                              -
                              {formatInteger(
                                item.quantitySent - (item.quantityReceived ?? 0),
                              )}{" "}
                              manquant ({item.discrepancyReason || "Non précisé"})
                            </span>
                          ) : (
                            <span className="text-primary font-medium">Conforme</span>
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

import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionCard, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { CancelSaleForm } from "@/components/sales/cancel-sale-form";
import { PrintButton } from "@/components/sales/print-button";
import { requirePage } from "@/server/auth/page";
import { getSaleDetail } from "@/server/services/sales";
import { formatDate, formatInteger, formatMoney } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SALE_STATUS_LABELS,
} from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Détail de la vente" };

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("sales.read");
  const { id } = await params;
  const detail = await getSaleDetail(context.shop.id, id);
  if (!detail) notFound();

  const {
    sale,
    items,
    payments,
    customerName,
    customerPhone,
    cashierName,
    warehouseName,
    warehouseCode,
  } = detail;
  const canCancel = context.permissions.has("sales.cancel");
  const currency = context.shop.currency;
  const costsComplete = items.every((item) => item.unitCostCents !== null);
  const costCents = items.reduce(
    (sum, item) => sum + (item.unitCostCents ?? 0) * item.quantity,
    0,
  );
  const marginCents = sale.totalCents - costCents;
  const marginPercent =
    costsComplete && sale.totalCents > 0
      ? (marginCents / sale.totalCents) * 100
      : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Vente"
        title={sale.number}
        description={`${formatDate(sale.createdAt, context.shop.timezone, true)} · ${formatInteger(
          items.reduce((sum, item) => sum + item.quantity, 0),
        )} article(s) · Entrepôt ${warehouseName ?? "—"}${
          warehouseCode ? ` (${warehouseCode})` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Link href="/sales" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Ventes
            </Link>
            <PrintButton />
            {canCancel && sale.status === "completed" && (
              <CancelSaleForm saleId={sale.id} saleNumber={sale.number} />
            )}
          </div>
        }
      />

      {sale.status === "cancelled" && (
        <div className="rounded-lg border border-red-200 bg-danger-soft px-4 py-3 text-[0.8125rem] text-red-800">
          <p className="font-medium">Cette vente a été annulée.</p>
          <p className="mt-0.5">
            {sale.cancelledAt
              ? formatDate(sale.cancelledAt, context.shop.timezone, true)
              : ""}
            {sale.cancelReason ? ` — Motif : ${sale.cancelReason}` : ""}
          </p>
          <p className="mt-0.5">
            Le stock a été réintégré et le paiement marqué comme remboursé.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-white px-4 py-3.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Total encaissé
          </p>
          <p className="tabular mt-1 font-mono text-xl font-semibold">
            {formatMoney(sale.totalCents, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Marge
          </p>
          <p className="tabular mt-1 font-mono text-xl font-semibold">
            {costsComplete ? formatMoney(marginCents, currency) : "—"}
          </p>
          <p className="mt-0.5 text-[0.6875rem] text-muted">
            {marginPercent !== null
              ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(
                  marginPercent,
                )} % du total`
              : "Coûts incomplets"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white px-4 py-3.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
            Statut
          </p>
          <div className="mt-2">
            <StatusPill tone={sale.status === "completed" ? "success" : "danger"}>
              {SALE_STATUS_LABELS[sale.status] ?? sale.status}
            </StatusPill>
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-muted">Par {cashierName ?? "—"}</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <SectionCard title="Articles vendus">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-2.5 font-semibold">Produit</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Qté</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Prix unitaire</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3">
                      <span className="font-medium">{item.productName}</span>
                      <span className="tabular mt-0.5 block font-mono text-[0.6875rem] text-muted">
                        {item.sku ?? "—"}
                      </span>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-mono">
                      {formatInteger(item.quantity)}
                    </td>
                    <td className="tabular px-3 py-3 text-right font-mono">
                      {formatMoney(item.unitPriceCents, currency)}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-mono font-medium">
                      {formatMoney(item.lineTotalCents, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line px-5 py-4">
            <div className="ml-auto max-w-xs space-y-1.5 text-[0.8125rem]">
              <div className="flex justify-between">
                <span className="text-muted">Sous-total</span>
                <span className="tabular font-mono">
                  {formatMoney(sale.subtotalCents, currency)}
                </span>
              </div>
              {sale.discountCents > 0 && (
                <div className="flex justify-between text-primary-dark">
                  <span>Remise</span>
                  <span className="tabular font-mono">
                    − {formatMoney(sale.discountCents, currency)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-1.5 text-[0.9375rem] font-semibold">
                <span>Total</span>
                <span className="tabular font-mono">
                  {formatMoney(sale.totalCents, currency)}
                </span>
              </div>
              {costsComplete && (
                <div className="flex justify-between text-[0.75rem] text-muted">
                  <span>Coût des articles</span>
                  <span className="tabular font-mono">{formatMoney(costCents, currency)}</span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Paiement">
            <div className="divide-y divide-line text-[0.8125rem]">
              {payments.map((payment) => (
                <div key={payment.id} className="space-y-2 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
                    </span>
                    <StatusPill tone={payment.status === "recorded" ? "success" : "warning"}>
                      {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                    </StatusPill>
                  </div>
                  <div className="flex items-center justify-between text-muted">
                    <span>Montant</span>
                    <span className="tabular font-mono text-ink">
                      {formatMoney(payment.amountCents, currency)}
                    </span>
                  </div>
                  {payment.reference && (
                    <div className="flex items-center justify-between gap-4 text-muted">
                      <span>Référence</span>
                      <span className="truncate text-right text-ink">{payment.reference}</span>
                    </div>
                  )}
                  <p className="text-[0.6875rem] text-muted">
                    {formatDate(payment.createdAt, context.shop.timezone, true)}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Client">
            <div className="px-5 py-4 text-[0.8125rem]">
              {sale.customerId ? (
                <>
                  <Link
                    href={`/customers/${sale.customerId}`}
                    className="font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                  >
                    {customerName ?? "Client"}
                  </Link>
                  <p className="mt-1 text-muted">{customerPhone ?? "Sans téléphone"}</p>
                </>
              ) : (
                <p className="text-muted">Client de passage</p>
              )}
            </div>
          </SectionCard>

          {(sale.note || canCancel) && (
            <SectionCard title="Notes et actions">
              <div className="space-y-3 px-5 py-4">
                {sale.note && (
                  <p className="rounded-md bg-surface px-3 py-2 text-[0.8125rem] text-muted">
                    {sale.note}
                  </p>
                )}
                {canCancel && sale.status === "completed" && (
                  <div className="print:hidden">
                    <p className="text-[0.75rem] leading-5 text-muted">
                      Une annulation réintègre le stock, marque le paiement comme remboursé
                      et reste tracée dans l&apos;audit.
                    </p>
                    <div className="mt-2">
                      <CancelSaleForm saleId={sale.id} saleNumber={sale.number} />
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

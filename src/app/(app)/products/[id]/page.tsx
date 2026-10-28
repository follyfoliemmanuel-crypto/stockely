import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionCard, StatusPill, EmptyState } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { ProductArchiveButton } from "@/components/products/product-archive-button";
import { requirePage } from "@/server/auth/page";
import { getProductDetail } from "@/server/services/products";
import { formatDate, formatInteger, formatMoney } from "@/lib/money";
import { MOVEMENT_TYPE_LABELS, movementTone } from "@/lib/labels";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: "Fiche produit", description: id };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("products.read");
  const { id } = await params;
  const detail = await getProductDetail(context, id);
  if (!detail) notFound();

  const product = detail.product;
  const canWrite = context.permissions.has("products.write");
  const canStock = context.permissions.has("stock.write");
  const currency = context.shop.currency;

  const marginCents =
    product.costCents != null ? product.priceCents - product.costCents : null;
  const marginPercent =
    marginCents != null && product.priceCents > 0
      ? (marginCents / product.priceCents) * 100
      : null;

  const stockTone =
    product.quantity <= 0
      ? "danger"
      : product.quantity <= product.minStock
        ? "warning"
        : "success";
  const stockLabel =
    product.quantity <= 0
      ? "Rupture de stock"
      : product.quantity <= product.minStock
        ? "Stock faible"
        : "Stock disponible";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Catalogue · ${product.sku}`}
        title={product.name}
        description={
          product.description ??
          "Fiche produit, prix, disponibilité et historique des mouvements de stock."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/products"
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Catalogue
            </Link>
            {canStock && !product.isArchived && (
              <Link
                href={`/stock/new?productId=${product.id}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Mouvement de stock
              </Link>
            )}
            {canWrite && (
              <Link
                href={`/products/${product.id}/edit`}
                className={buttonClasses({ size: "sm" })}
              >
                Modifier
              </Link>
            )}
            {canWrite && (
              <ProductArchiveButton
                productId={product.id}
                archived={product.isArchived}
                productName={product.name}
              />
            )}
          </div>
        }
      />

      {product.isArchived && (
        <div className="rounded-lg border border-amber-200 bg-warning-soft px-4 py-3 text-[0.8125rem] text-amber-900">
          Ce produit est archivé. Il reste consultable et son historique est conservé,
          mais il n&apos;est plus proposé à la vente ni aux mouvements de stock.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Prix de vente",
            value: formatMoney(product.priceCents, currency),
            hint: "TTC",
            tone: "default",
          },
          {
            label: "Prix d'achat",
            value:
              product.costCents != null
                ? formatMoney(product.costCents, currency)
                : "Non renseigné",
            hint:
              marginPercent != null
                ? `Marge ${new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 1,
                  }).format(marginPercent)} %`
                : "Marge indisponible",
            tone: "default",
          },
          {
            label: "Stock disponible",
            value: `${formatInteger(product.quantity)} u.`,
            hint: `Seuil ${formatInteger(product.minStock)} u.`,
            tone: product.quantity <= 0 ? "danger" : product.quantity <= product.minStock ? "warning" : "default",
          },
          {
            label: "Valeur du stock",
            value: formatMoney(
              (product.costCents ?? product.priceCents) * product.quantity,
              currency,
            ),
            hint: product.costCents != null ? "Au prix d'achat" : "À défaut, au prix de vente",
            tone: "default",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-line/90 bg-white px-4 py-3.5 shadow-card">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p
              className={cn(
                "tabular mt-1 font-mono text-lg font-medium",
                stat.tone === "danger" && "text-danger",
                stat.tone === "warning" && "text-warning",
              )}
            >
              {stat.value}
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <SectionCard
          title="Derniers mouvements"
          description="Chaque entrée, sortie, vente ou correction est enregistrée avec son auteur."
          actions={
            <Link
              href={`/stock?product=${product.id}`}
              className="text-[0.75rem] font-medium text-primary-dark underline-offset-2 hover:underline"
            >
              Tout l&apos;historique
            </Link>
          }
        >
          {detail.movements.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                title="Aucun mouvement"
                body="Les entrées de stock, ventes et corrections apparaîtront ici."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Motif</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Quantité</th>
                    <th className="px-5 py-2.5 font-semibold">Par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {detail.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-muted">
                        {formatDate(movement.createdAt, context.shop.timezone, true)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill tone={movementTone(movement.type)}>
                          {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
                        </StatusPill>
                      </td>
                      <td className="max-w-56 truncate px-3 py-3 text-muted">
                        {movement.saleId ? (
                          <Link
                            href={`/sales/${movement.saleId}`}
                            className="underline-offset-2 hover:text-ink hover:underline"
                          >
                            {movement.reason ?? "Vente"}
                          </Link>
                        ) : (
                          movement.reason ?? "—"
                        )}
                      </td>
                      <td
                        className={cn(
                          "tabular px-3 py-3 text-right font-mono font-medium",
                          movement.quantityDelta > 0 ? "text-primary-dark" : "text-danger",
                        )}
                      >
                        {movement.quantityDelta > 0 ? "+" : ""}
                        {formatInteger(movement.quantityDelta)}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {movement.userName ?? "Système"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="État du stock">
            <div className="space-y-4 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[0.8125rem] text-muted">Disponibilité</span>
                <StatusPill tone={stockTone}>{stockLabel}</StatusPill>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.8125rem] text-muted">Quantité</span>
                  <span className="tabular font-mono text-xl font-medium">
                    {formatInteger(product.quantity)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      product.quantity <= 0
                        ? "bg-danger"
                        : product.quantity <= product.minStock
                          ? "bg-warning"
                          : "bg-primary",
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        product.minStock > 0
                          ? (product.quantity / (product.minStock * 4)) * 100
                          : 100,
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[0.6875rem] text-muted">
                  Seuil d&apos;alerte : {formatInteger(product.minStock)} unité(s)
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Stock par entrepôt"
            description={`Total boutique : ${formatInteger(product.quantity)} unité(s).`}
          >
            {detail.stockByWarehouse.length === 0 ? (
              <div className="px-5 py-4 text-[0.8125rem] text-muted">
                Aucun stock enregistré.
              </div>
            ) : (
              <dl className="divide-y divide-line text-[0.8125rem]">
                {detail.stockByWarehouse.map((row) => (
                  <div
                    key={row.warehouseId}
                    className="flex items-center justify-between gap-4 px-5 py-2.5"
                  >
                    <dt className="min-w-0 truncate text-muted">
                      {row.warehouseName}
                      {row.isDefault ? " · défaut" : ""}
                    </dt>
                    <dd className="tabular shrink-0 font-mono font-medium">
                      {formatInteger(row.quantity)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </SectionCard>

          <SectionCard title="Informations">
            <dl className="divide-y divide-line text-[0.8125rem]">
              {[
                ["SKU", product.sku],
                ["Code-barres", product.barcode ?? "—"],
                ["Catégorie", detail.categoryName ?? "—"],
                ["Fournisseur", detail.supplierName ?? "—"],
                ["Créé le", formatDate(product.createdAt, context.shop.timezone)],
                ["Modifié le", formatDate(product.updatedAt, context.shop.timezone)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 px-5 py-2.5">
                  <dt className="text-muted">{label}</dt>
                  <dd className="max-w-[55%] break-words text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

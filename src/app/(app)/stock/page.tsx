import Link from "next/link";

import { PageHeader, EmptyState, Pagination, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import {
  getStockStats,
  listStockMovements,
  listStockProductOptions,
  type StockListFilters,
} from "@/server/services/stock";
import { getProductStats } from "@/server/services/products";
import { formatDate, formatInteger } from "@/lib/money";
import { MOVEMENT_TYPE_LABELS, movementTone } from "@/lib/labels";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mouvements de stock" };

const FILTER_TYPES = [
  ["", "Tous les types"],
  ["in", "Entrées"],
  ["out", "Sorties"],
  ["sale", "Ventes"],
  ["adjustment", "Corrections"],
  ["reversal", "Compensations"],
] as const;

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("stock.read");
  const params = await searchParams;

  const q = firstParam(params.q)?.trim() ?? "";
  const productId = firstParam(params.product) ?? "";
  const type = (firstParam(params.type) ?? "") as StockListFilters["type"] | "";
  const page = pageParam(params.page);
  const warehouse = await resolveRequestWarehouse(context);

  const [result, stats, productStats, products] = await Promise.all([
    listStockMovements(context, {
      q: q || undefined,
      productId: productId || undefined,
      warehouseId: warehouse.id,
      type: type || undefined,
      page,
    }),
    getStockStats(context.shop.id, warehouse.id),
    getProductStats(context.shop.id, warehouse.id),
    listStockProductOptions(context.shop.id, warehouse.id),
  ]);

  const canWrite = context.permissions.has("stock.write");
  const current = {
    q: q || undefined,
    product: productId || undefined,
    type: type || undefined,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Opérations"
        title="Mouvements de stock"
        description={`Historique des entrées, sorties, ventes et corrections de l'entrepôt ${warehouse.name} (${warehouse.code}).`}
        actions={
          canWrite ? (
            <Link href="/stock/new" className={buttonClasses({ size: "sm" })}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Nouveau mouvement
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Entrées · 30 j", value: formatInteger(stats.entries), tone: "success" },
          { label: "Sorties · 30 j", value: formatInteger(stats.exits), tone: "danger" },
          { label: "Solde net · 30 j", value: formatInteger(stats.entries - stats.exits) },
          { label: "Ruptures actuelles", value: formatInteger(productStats.out), tone: productStats.out > 0 ? "warning" : undefined },
        ].map((stat) => (
          <div key={stat.label} className="px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p
              className={cn(
                "tabular mt-1 font-mono text-xl font-medium",
                stat.tone === "success" && "text-primary-dark",
                stat.tone === "danger" && "text-danger",
                stat.tone === "warning" && "text-warning",
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-line/90 bg-white shadow-card">
        <form
          method="get"
          className="grid gap-2 border-b border-line bg-surface/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_14rem_10rem_auto] sm:items-end"
        >
          <div>
            <label htmlFor="q" className="text-[0.6875rem] font-medium text-muted">
              Produit
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nom ou SKU"
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-3 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <label htmlFor="product" className="text-[0.6875rem] font-medium text-muted">
              Référence précise
            </label>
            <select
              id="product"
              name="product"
              defaultValue={productId}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Tous les produits</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="text-[0.6875rem] font-medium text-muted">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={type}
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {FILTER_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Filtrer
            </button>
            {(q || productId || type) && (
              <Link
                href="/stock"
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
              title={q || productId || type ? "Aucun mouvement trouvé" : "Aucun mouvement pour l'instant"}
              body={
                q || productId || type
                  ? "Modifiez les filtres pour élargir la recherche."
                  : "Les entrées de stock et les ventes alimenteront automatiquement cet historique."
              }
              action={
                canWrite && !q && !productId && !type ? (
                  <Link href="/stock/new" className={buttonClasses({ size: "sm" })}>
                    Enregistrer un mouvement
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full lg:min-w-[48rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="hidden px-5 py-2.5 font-semibold sm:table-cell">Date</th>
                  <th className="px-4 py-2.5 font-semibold sm:px-5">Produit</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Type</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Motif</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Variation</th>
                  <th className="hidden px-5 py-2.5 font-semibold lg:table-cell">Par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((movement) => (
                  <tr key={movement.id} className="transition-colors hover:bg-surface/60">
                    <td className="hidden whitespace-nowrap px-5 py-3 text-muted sm:table-cell">
                      {formatDate(movement.createdAt, context.shop.timezone, true)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/products/${movement.productId}`}
                        className="font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                      >
                        {movement.productName}
                      </Link>
                      <span className="tabular mt-0.5 block font-mono text-[0.6875rem] text-muted">
                        {movement.productSku}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:hidden">
                        <StatusPill tone={movementTone(movement.type)}>
                          {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
                        </StatusPill>
                        <span className="tabular whitespace-nowrap font-mono text-[0.625rem] text-muted">
                          {formatDate(movement.createdAt, context.shop.timezone, true)}
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <StatusPill tone={movementTone(movement.type)}>
                        {MOVEMENT_TYPE_LABELS[movement.type] ?? movement.type}
                      </StatusPill>
                    </td>
                    <td className="hidden max-w-64 truncate px-4 py-3 text-muted md:table-cell">
                      {movement.saleId ? (
                        <Link
                          href={`/sales/${movement.saleId}`}
                          className="underline-offset-2 hover:text-ink hover:underline"
                        >
                          {movement.reason ?? "Vente"}
                        </Link>
                      ) : (
                        (movement.reason ?? "—")
                      )}
                    </td>
                    <td
                      className={cn(
                        "tabular px-4 py-3 text-right font-mono font-medium",
                        movement.quantityDelta > 0 ? "text-primary-dark" : "text-danger",
                      )}
                    >
                      {movement.quantityDelta > 0 ? "+" : ""}
                      {formatInteger(movement.quantityDelta)}
                    </td>
                    <td className="hidden px-5 py-3 text-muted lg:table-cell">
                      {movement.userName ?? "Système"}
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
            result.page > 1 ? `/stock${buildQuery(current, { page: result.page - 1 })}` : null
          }
          nextHref={
            result.page < result.pageCount
              ? `/stock${buildQuery(current, { page: result.page + 1 })}`
              : null
          }
        />
      </section>
    </div>
  );
}

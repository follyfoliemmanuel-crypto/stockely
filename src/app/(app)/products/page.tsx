import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import {
  DonutChart,
  KpiCard,
  ProgressBar,
  initialsFromName,
} from "@/components/ui/metrics";
import {
  EmptyState,
  PageHeader,
  Pagination,
  SectionCard,
  StatusPill,
} from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { formatInteger, formatMoney } from "@/lib/money";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import {
  getProductStats,
  listCategoriesWithCounts,
  listProducts,
  type ProductListFilters,
} from "@/server/services/products";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produits" };

function StockBadge({
  quantity,
  minStock,
}: {
  quantity: number;
  minStock: number;
}) {
  if (quantity <= 0) return <StatusPill tone="danger">Rupture</StatusPill>;
  if (quantity <= minStock) return <StatusPill tone="warning">Stock faible</StatusPill>;
  return <StatusPill tone="success">En stock</StatusPill>;
}

const selectClass =
  "mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-[0.8125rem] text-ink shadow-soft outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("products.read");
  const params = await searchParams;

  const q = firstParam(params.q)?.trim() ?? "";
  const categoryId = firstParam(params.category) ?? "";
  const stock = (firstParam(params.stock) ?? "all") as ProductListFilters["stock"];
  const archived = (firstParam(params.archived) ?? "active") as ProductListFilters["archived"];
  const page = pageParam(params.page);

  const filters: ProductListFilters = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    stock,
    archived,
    page,
  };

  const warehouse = await resolveRequestWarehouse(context);

  const [result, categories, stats] = await Promise.all([
    listProducts(context.shop.id, filters, warehouse.id),
    listCategoriesWithCounts(context.shop.id),
    getProductStats(context.shop.id, warehouse.id),
  ]);

  const current = {
    q: q || undefined,
    category: categoryId || undefined,
    stock: stock === "all" ? undefined : stock,
    archived: archived === "active" ? undefined : archived,
  };

  const canWrite = context.permissions.has("products.write");
  const currency = context.shop.currency;
  const alertCount = stats.out + stats.low;
  const healthy = Math.max(0, stats.total - alertCount);
  const healthPct = stats.total > 0 ? (healthy / stats.total) * 100 : 100;
  const sortedCategories = [...categories]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 6);
  const maxCategoryCount = Math.max(
    1,
    ...sortedCategories.map((category) => category.productCount),
  );

  return (
    <div className="animate-rise space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="Produits"
        description={`Votre catalogue, les niveaux de stock de ${warehouse.name} et les prix de vente de la boutique active.`}
        actions={
          canWrite ? (
            <Link href="/products/new" className={buttonClasses({ size: "sm" })}>
              <span aria-hidden="true" className="text-base leading-none">+</span>
              Nouveau produit
            </Link>
          ) : null
        }
      />

      <section aria-label="Indicateurs du catalogue">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Références actives"
            value={formatInteger(stats.total)}
            hint={`${formatInteger(stats.archived)} référence${stats.archived > 1 ? "s" : ""} archivée${stats.archived > 1 ? "s" : ""}`}
            icon="package"
            tone="primary"
          />
          <KpiCard
            label="Unités en stock"
            value={formatInteger(stats.units)}
            hint={`${warehouse.name} · ${formatMoney(stats.valueCents, currency)} de valeur`}
            icon="boxes"
            tone="accent"
          />
          <KpiCard
            label="Valeur du stock"
            value={formatMoney(stats.valueCents, currency)}
            hint="Au prix d'achat, sinon au prix de vente."
            icon="wallet"
            tone="info"
          />
          <KpiCard
            label="Alertes stock"
            value={formatInteger(alertCount)}
            hint={`${formatInteger(stats.out)} rupture${stats.out > 1 ? "s" : ""} · ${formatInteger(stats.low)} sous seuil`}
            icon="alert"
            tone={stats.out > 0 ? "danger" : "accent"}
            footer={
              <div>
                <div className="flex items-center justify-between text-[0.625rem] font-semibold text-muted">
                  <span>Catalogue sain</span>
                  <span className="tabular">{Math.round(healthPct)} %</span>
                </div>
                <ProgressBar
                  value={healthPct}
                  tone={stats.out > 0 ? "danger" : "primary"}
                  className="mt-1.5"
                  label="Part du catalogue au-dessus du seuil"
                />
              </div>
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <SectionCard
          title="Tous les produits"
          description={`${formatInteger(result.total)} résultat${result.total > 1 ? "s" : ""} pour ${warehouse.name}.`}
          className="min-w-0"
        >
          <form
            method="get"
            className="grid gap-3 border-b border-line/80 bg-surface/60 px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_9rem_auto] xl:items-end"
          >
            <div>
              <label htmlFor="q" className="text-[0.6875rem] font-bold text-muted">
                Rechercher
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
                  placeholder="Nom, SKU ou code-barres"
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[0.8125rem] text-ink shadow-soft outline-none placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>
            <div>
              <label htmlFor="category" className="text-[0.6875rem] font-bold text-muted">
                Catégorie
              </label>
              <select
                id="category"
                name="category"
                defaultValue={categoryId}
                className={selectClass}
              >
                <option value="">Toutes</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="stock" className="text-[0.6875rem] font-bold text-muted">
                Stock
              </label>
              <select id="stock" name="stock" defaultValue={stock} className={selectClass}>
                <option value="all">Tous</option>
                <option value="ok">Disponible</option>
                <option value="low">Faible</option>
                <option value="out">Rupture</option>
              </select>
            </div>
            <div>
              <label htmlFor="archived" className="text-[0.6875rem] font-bold text-muted">
                Statut
              </label>
              <select
                id="archived"
                name="archived"
                defaultValue={archived}
                className={selectClass}
              >
                <option value="active">Actifs</option>
                <option value="archived">Archivés</option>
                <option value="all">Tous</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className={buttonClasses({ size: "sm", variant: "secondary" })}
              >
                Filtrer
              </button>
              {(q || categoryId || stock !== "all" || archived !== "active") && (
                <Link
                  href="/products"
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
                title={
                  q || categoryId
                    ? "Aucun produit ne correspond"
                    : "Aucun produit pour l'instant"
                }
                body={
                  q || categoryId
                    ? "Essayez un autre terme ou retirez les filtres pour retrouver votre catalogue."
                    : "Créez votre première référence pour commencer à vendre et suivre le stock."
                }
                action={
                  canWrite && !q && !categoryId ? (
                    <Link href="/products/new" className={buttonClasses({ size: "sm" })}>
                      Créer un produit
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table md:min-w-[44rem]">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 font-bold sm:px-5 md:px-6">
                      Produit
                    </th>
                    <th scope="col" className="hidden px-5 py-3 font-bold md:table-cell">
                      Catégorie
                    </th>
                    <th scope="col" className="hidden px-5 py-3 text-right font-bold sm:table-cell">
                      Prix
                    </th>
                    <th scope="col" className="px-4 py-3 text-right font-bold sm:px-5">
                      Stock
                    </th>
                    <th scope="col" className="px-4 py-3 font-bold sm:px-5">
                      État
                    </th>
                    <th scope="col" className="hidden w-10 px-3 py-3 sm:table-cell">
                      <span className="sr-only">Ouvrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {result.items.map((product) => (
                    <tr key={product.id} className="group">
                      <td className="px-4 py-3 sm:px-5 md:px-6">
                        <Link href={`/products/${product.id}`} className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-[0.6875rem] font-bold text-accent-ink sm:flex"
                          >
                            {initialsFromName(product.name)}
                          </span>
                          <span className="min-w-0 max-w-[11rem] md:max-w-none">
                            <span className="block truncate font-semibold text-ink group-hover:text-primary-dark">
                              {product.name}
                            </span>
                            <span className="tabular mt-0.5 block truncate font-mono text-[0.625rem] text-muted">
                              {product.sku}
                              {product.barcode ? ` · ${product.barcode}` : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-5 py-3 text-muted md:table-cell">
                        {product.categoryName ?? <span className="text-muted/60">—</span>}
                      </td>
                      <td className="tabular hidden px-5 py-3 text-right font-mono font-semibold sm:table-cell">
                        {formatMoney(product.priceCents, currency)}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-mono sm:px-5">
                        <span
                          className={cn(
                            "font-semibold",
                            product.quantity <= 0 && "text-danger",
                            product.quantity > 0 &&
                              product.quantity <= product.minStock &&
                              "text-warning",
                          )}
                        >
                          {formatInteger(product.quantity)}
                        </span>
                        <span className="ml-1 text-[0.625rem] text-muted">u.</span>
                        <span className="mt-0.5 block whitespace-nowrap font-mono text-[0.625rem] text-muted">
                          min. {formatInteger(product.minStock)}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {product.isArchived ? (
                          <StatusPill>Archivé</StatusPill>
                        ) : (
                          <StockBadge
                            quantity={product.quantity}
                            minStock={product.minStock}
                          />
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-right sm:table-cell">
                        <Link
                          href={`/products/${product.id}`}
                          aria-label={`Voir ${product.name}`}
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
                ? `/products${buildQuery(current, { page: result.page - 1 })}`
                : null
            }
            nextHref={
              result.page < result.pageCount
                ? `/products${buildQuery(current, { page: result.page + 1 })}`
                : null
            }
          />
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="État du stock"
            description={`${formatInteger(stats.total)} références actives.`}
          >
            <div className="flex flex-col items-center gap-5 px-5 pb-5">
              <DonutChart
                segments={[
                  { label: "Disponible", value: healthy, color: "#2E7D5B" },
                  { label: "Stock faible", value: stats.low, color: "#E9D66B" },
                  { label: "Rupture", value: stats.out, color: "#C4553F" },
                ]}
                centerValue={formatInteger(stats.total)}
                centerLabel="références actives"
                size={144}
              />
              <ul className="w-full space-y-2.5">
                {[
                  { label: "Disponible", value: healthy, color: "#2E7D5B" },
                  { label: "Stock faible", value: stats.low, color: "#E9D66B" },
                  { label: "Rupture", value: stats.out, color: "#C4553F" },
                ].map((segment) => (
                  <li
                    key={segment.label}
                    className="flex items-center justify-between gap-3 rounded-xl bg-surface/80 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-[0.75rem] font-semibold">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: segment.color }}
                      />
                      {segment.label}
                    </span>
                    <span className="tabular text-[0.75rem] font-bold">
                      {formatInteger(segment.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard
            title="Catégories"
            description="Références actives par famille."
            actions={
              <Link
                href="/categories"
                className="text-[0.75rem] font-bold text-primary-dark underline-offset-4 hover:underline"
              >
                Gérer
              </Link>
            }
          >
            {sortedCategories.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  title="Aucune catégorie"
                  body="Organisez votre catalogue en créant des familles de produits."
                  action={
                    canWrite ? (
                      <Link href="/categories" className={buttonClasses({ size: "sm", variant: "secondary" })}>
                        Créer une catégorie
                      </Link>
                    ) : null
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3.5 px-5 pb-5">
                {sortedCategories.map((category) => (
                  <li key={category.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[0.75rem] font-semibold">
                        {category.name}
                      </span>
                      <span className="tabular shrink-0 text-[0.6875rem] font-semibold text-muted">
                        {formatInteger(category.productCount)}
                      </span>
                    </div>
                    <ProgressBar
                      value={(category.productCount / maxCategoryCount) * 100}
                      tone="accent"
                      className="mt-1.5"
                      label={`${category.name} : ${category.productCount} produits`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

import { PageHeader, EmptyState, Pagination, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { listSuppliers } from "@/server/services/suppliers";
import { formatDate, formatInteger } from "@/lib/money";
import { buildQuery, firstParam, pageParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fournisseurs" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("suppliers.read");
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const page = pageParam(params.page);
  const result = await listSuppliers(context.shop.id, { q: q || undefined, page });
  const canWrite = context.permissions.has("suppliers.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts"
        title="Fournisseurs"
        description="Répertoire des fournisseurs et des produits qui leur sont rattachés."
        actions={
          canWrite ? (
            <Link href="/suppliers/new" className={buttonClasses({ size: "sm" })}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              Nouveau fournisseur
            </Link>
          ) : null
        }
      />

      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <form
          method="get"
          className="flex flex-col gap-2 border-b border-line bg-surface/60 px-4 py-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="q" className="text-[0.6875rem] font-medium text-muted">
              Rechercher un fournisseur
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Nom, téléphone ou e-mail"
              className="mt-1 h-9 w-full rounded-md border border-line bg-white px-3 text-[0.8125rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Rechercher
            </button>
            {q && (
              <Link
                href="/suppliers"
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
              title={q ? "Aucun fournisseur trouvé" : "Aucun fournisseur pour l'instant"}
              body={
                q
                  ? "Essayez un autre nom, numéro ou adresse e-mail."
                  : "Ajoutez vos fournisseurs pour les rattacher aux produits et suivre les réapprovisionnements."
              }
              action={
                canWrite && !q ? (
                  <Link href="/suppliers/new" className={buttonClasses({ size: "sm" })}>
                    Créer un fournisseur
                  </Link>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-[0.8125rem]">
              <thead>
                <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  <th className="px-5 py-2.5 font-semibold">Fournisseur</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Produits</th>
                  <th className="px-4 py-2.5 font-semibold">Depuis</th>
                  {canWrite && <th className="px-5 py-2.5 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.items.map((supplier) => (
                  <tr key={supplier.id} className="transition-colors hover:bg-surface/60">
                    <td className="px-5 py-3">
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.address && (
                        <span className="mt-0.5 block max-w-56 truncate text-[0.6875rem] text-muted">
                          {supplier.address}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span className="block">{supplier.phone ?? "—"}</span>
                      {supplier.email && (
                        <span className="block max-w-48 truncate text-[0.6875rem]">
                          {supplier.email}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <StatusPill tone={supplier.productCount > 0 ? "success" : "neutral"}>
                        {formatInteger(supplier.productCount)}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(supplier.createdAt, context.shop.timezone)}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/suppliers/${supplier.id}/edit`}
                          className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-muted hover:bg-surface hover:text-ink"
                        >
                          Modifier
                        </Link>
                      </td>
                    )}
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
              ? `/suppliers${buildQuery({ q: q || undefined }, { page: result.page - 1 })}`
              : null
          }
          nextHref={
            result.page < result.pageCount
              ? `/suppliers${buildQuery({ q: q || undefined }, { page: result.page + 1 })}`
              : null
          }
        />
      </section>
    </div>
  );
}

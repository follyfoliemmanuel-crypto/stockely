import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionCard, EmptyState, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { getCustomerWithSales } from "@/server/services/customers";
import { formatDate, formatMoney } from "@/lib/money";
import { SALE_STATUS_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fiche client" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("customers.read");
  const { id } = await params;
  const detail = await getCustomerWithSales(context.shop.id, id);
  if (!detail) notFound();

  const { customer, history } = detail;
  const canWrite = context.permissions.has("customers.write");
  const canSell = context.permissions.has("sales.create");
  const completed = history.filter((sale) => sale.status === "completed");
  const totalSpent = completed.reduce((sum, sale) => sum + sale.totalCents, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Contacts · Client"
        title={customer.name}
        description={customer.address ?? "Fiche client et historique des achats."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/customers" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Clients
            </Link>
            {canSell && (
              <Link
                href={`/sales/new?customerId=${customer.id}`}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Nouvelle vente
              </Link>
            )}
            {canWrite && (
              <Link
                href={`/customers/${customer.id}/edit`}
                className={buttonClasses({ size: "sm" })}
              >
                Modifier
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Ventes terminées", value: String(completed.length) },
          {
            label: "Total dépensé",
            value: formatMoney(totalSpent, context.shop.currency),
          },
          {
            label: "Client depuis",
            value: formatDate(customer.createdAt, context.shop.timezone),
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-white px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p className="mt-1 text-[1.05rem] font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <SectionCard title="Coordonnées">
          <dl className="divide-y divide-line text-[0.8125rem]">
            {[
              ["Téléphone", customer.phone ?? "—"],
              ["E-mail", customer.email ?? "—"],
              ["Adresse", customer.address ?? "—"],
              ["Notes", customer.notes ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="px-5 py-3">
                <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-muted">
                  {label}
                </dt>
                <dd className="mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard
          title="Historique des achats"
          description="Les 20 ventes les plus récentes rattachées à ce client."
        >
          {history.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                title="Aucun achat"
                body={
                  canSell
                    ? "Lancez une vente depuis la caisse pour rattacher un achat à ce client."
                    : "Aucune vente n'est encore rattachée à cette fiche."
                }
                action={
                  canSell ? (
                    <Link
                      href={`/sales/new?customerId=${customer.id}`}
                      className={buttonClasses({ size: "sm" })}
                    >
                      Passer une vente
                    </Link>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-left text-[0.8125rem]">
                <thead>
                  <tr className="border-b border-line text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                    <th className="px-5 py-2.5 font-semibold">Vente</th>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold">Statut</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {history.map((sale) => (
                    <tr key={sale.id} className="transition-colors hover:bg-surface/60">
                      <td className="px-5 py-3">
                        <Link
                          href={`/sales/${sale.id}`}
                          className="tabular font-mono text-[0.75rem] font-medium underline-offset-2 hover:text-primary-dark hover:underline"
                        >
                          {sale.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(sale.createdAt, context.shop.timezone, true)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={sale.status === "completed" ? "success" : "danger"}>
                          {SALE_STATUS_LABELS[sale.status] ?? sale.status}
                        </StatusPill>
                      </td>
                      <td className="tabular px-5 py-3 text-right font-mono">
                        {formatMoney(sale.totalCents, context.shop.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

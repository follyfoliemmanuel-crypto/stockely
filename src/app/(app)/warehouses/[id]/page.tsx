import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader, SectionCard, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { WarehouseAccessForm } from "@/components/warehouses/warehouse-access-form";
import { WarehouseEditForm } from "@/components/warehouses/warehouse-edit-form";
import { requirePage } from "@/server/auth/page";
import { formatDate, formatInteger } from "@/lib/money";
import {
  getWarehouse,
  hasAllWarehouseAccess,
  listWarehouseMembers,
  listWarehouseOverview,
} from "@/server/services/warehouses";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: "Entrepôt", description: id };
}

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("warehouses.read");
  const { id } = await params;
  const warehouse = await getWarehouse(context.shop.id, id);
  if (!warehouse) notFound();

  const [overview, members] = await Promise.all([
    listWarehouseOverview(context.shop.id),
    listWarehouseMembers(context.shop.id, warehouse.id),
  ]);
  const stats = overview.find((row) => row.id === warehouse.id);
  const canWrite = context.permissions.has("warehouses.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`Opérations · ${warehouse.code}`}
        title={warehouse.name}
        description={warehouse.address ?? "Entrepôt de stockage de la boutique."}
        actions={
          <Link
            href="/warehouses"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Tous les entrepôts
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Références en stock",
            value: formatInteger(stats?.skuCount ?? 0),
          },
          {
            label: "Unités stockées",
            value: formatInteger(stats?.quantity ?? 0),
          },
          {
            label: "Créé le",
            value: formatDate(warehouse.createdAt, context.shop.timezone),
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-white px-4 py-3.5">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted">
              {stat.label}
            </p>
            <p className="tabular mt-1 font-mono text-lg font-medium">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {warehouse.isDefault && <StatusPill tone="success">Entrepôt par défaut</StatusPill>}
        {warehouse.isActive ? (
          <StatusPill tone="neutral">Actif</StatusPill>
        ) : (
          <StatusPill tone="warning">Archivé</StatusPill>
        )}
      </div>

      {canWrite ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard
            title="Paramètres"
            description="Renommer ou changer le code n'affecte pas les mouvements déjà enregistrés."
          >
            <WarehouseEditForm warehouse={warehouse} />
          </SectionCard>

          <SectionCard
            title="Utilisateurs autorisés"
            description="Un membre sans autorisation explicite ne voit que l'entrepôt par défaut."
          >
            <WarehouseAccessForm
              warehouseId={warehouse.id}
              members={members.map((member) => ({
                membershipId: member.membershipId,
                name: member.name,
                email: member.email,
                role: member.role,
                hasAccess: member.hasAccess,
                hasAllAccess: hasAllWarehouseAccess(member.role),
              }))}
            />
          </SectionCard>
        </div>
      ) : (
        <SectionCard title="Utilisateurs autorisés">
          <ul className="divide-y divide-line text-[0.8125rem]">
            {members
              .filter((member) => member.hasAccess || hasAllWarehouseAccess(member.role))
              .map((member) => (
                <li
                  key={member.membershipId}
                  className="flex items-center justify-between gap-4 px-5 py-2.5"
                >
                  <span>{member.name}</span>
                  <span className="text-[0.75rem] text-muted">{member.email}</span>
                </li>
              ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

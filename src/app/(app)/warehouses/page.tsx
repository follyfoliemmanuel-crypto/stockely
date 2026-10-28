import Link from "next/link";

import { PageHeader, SectionCard, StatusPill } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { WarehouseCreateForm } from "@/components/warehouses/warehouse-create-form";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { formatInteger } from "@/lib/money";
import { listWarehouseOverview } from "@/server/services/warehouses";

export const dynamic = "force-dynamic";

export const metadata = { title: "Entrepôts" };

export default async function WarehousesPage() {
  const context = await requirePage("warehouses.read");
  const [warehouses, activeWarehouse] = await Promise.all([
    listWarehouseOverview(context),
    resolveRequestWarehouse(context),
  ]);
  const canWrite = context.permissions.has("warehouses.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Opérations"
        title="Entrepôts"
        description={`Organisez le stock par lieu. Entrepôt de travail actuel : ${activeWarehouse.name} (${activeWarehouse.code}).`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {warehouses.map((warehouse) => (
          <Link
            key={warehouse.id}
            href={`/warehouses/${warehouse.id}`}
            className="group rounded-2xl border border-line/90 bg-white p-4 shadow-card transition-colors hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[0.9375rem] font-medium group-hover:text-primary-dark">
                  {warehouse.name}
                </p>
                <p className="tabular mt-0.5 font-mono text-[0.6875rem] text-muted">
                  {warehouse.code}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {warehouse.isDefault && <StatusPill tone="success">Défaut</StatusPill>}
                {!warehouse.isActive && <StatusPill tone="neutral">Archivé</StatusPill>}
              </div>
            </div>

            {warehouse.address && (
              <p className="mt-2 truncate text-[0.75rem] text-muted">
                {warehouse.address}
              </p>
            )}

            <div className="tabular mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 font-mono text-[0.75rem]">
              <div>
                <p className="text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  Références
                </p>
                <p className="mt-0.5 text-[0.9375rem] font-medium">
                  {formatInteger(warehouse.skuCount)}
                </p>
              </div>
              <div>
                <p className="text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                  Unités
                </p>
                <p className="mt-0.5 text-[0.9375rem] font-medium">
                  {formatInteger(warehouse.quantity)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {canWrite && (
        <SectionCard
          title="Nouvel entrepôt"
          description="Le code est unique par boutique. Créer un entrepôt ne modifie aucun stock existant."
        >
          <WarehouseCreateForm />
        </SectionCard>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line/90 bg-white px-4 py-3 text-[0.8125rem] shadow-card">
        <p className="text-muted">
          Le stock total affiché dans le catalogue reste la somme de tous les
          entrepôts.
        </p>
        <Link
          href="/stock"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Voir les mouvements
        </Link>
      </div>
    </div>
  );
}

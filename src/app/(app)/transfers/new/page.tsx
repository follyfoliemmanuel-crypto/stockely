import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { buttonClasses } from "@/components/ui/button";
import { TransferCreateForm } from "@/components/transfers/transfer-create-form";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { listAccessibleWarehouses } from "@/server/services/warehouses";
import { listProducts } from "@/server/services/products";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau transfert" };

export default async function NewTransferPage() {
  const context = await requirePage("transfers.create");

  const [warehouses, activeWarehouse, productResult] = await Promise.all([
    listAccessibleWarehouses(context),
    resolveRequestWarehouse(context),
    listProducts(context.shop.id, { pageSize: 100 }),
  ]);

  if (warehouses.length < 2) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Transferts"
          title="Nouveau transfert"
          description="Déplacez des articles d'un entrepôt vers un autre."
        />
        <div className="rounded-xl border border-warning/40 bg-warning-soft p-5 text-sm text-warning">
          <p className="font-semibold">Plusieurs entrepôts nécessaires</p>
          <p className="mt-1">
            Votre entreprise doit disposer d'au moins deux entrepôts actifs pour pouvoir effectuer un transfert.
          </p>
          <div className="mt-4">
            <Link
              href="/warehouses"
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              Gérer les entrepôts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const availableProducts = productResult.items.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          eyebrow="Transferts"
          title="Créer un transfert de stock"
          description="Les quantités indiquées seront déduites de l'entrepôt source dès la préparation du transfert."
        />
        <Link
          href="/transfers"
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Retour à la liste
        </Link>
      </div>

      <TransferCreateForm
        warehouses={warehouses}
        initialFromWarehouseId={activeWarehouse.id}
        availableProducts={availableProducts}
      />
    </div>
  );
}

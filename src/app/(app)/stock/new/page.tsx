import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { StockMovementForm } from "@/components/stock/stock-movement-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { listStockProductOptions } from "@/server/services/stock";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau mouvement de stock" };

export default async function NewStockMovementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("stock.write");
  const params = await searchParams;
  const warehouse = await resolveRequestWarehouse(context);
  const products = await listStockProductOptions(context.shop.id, warehouse.id);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Opérations"
        title="Nouveau mouvement de stock"
        description={`Entrée, sortie ou correction d'inventaire dans l'entrepôt ${warehouse.name} (${warehouse.code}). Le stock est mis à jour de façon atomique et chaque opération est auditée.`}
        actions={
          <Link
            href="/stock"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Historique
          </Link>
        }
      />
      <StockMovementForm
        products={products}
        currency={context.shop.currency}
        initialProductId={firstParam(params.productId)}
      />
    </div>
  );
}

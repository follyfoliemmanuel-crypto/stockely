import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { PosTerminal } from "@/components/sales/pos-terminal";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { listCustomerOptions } from "@/server/services/customers";
import { searchProducts } from "@/server/services/products";
import { firstParam, type SearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouvelle vente" };

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requirePage("sales.create");
  const params = await searchParams;
  const warehouse = await resolveRequestWarehouse(context);

  const [products, customers] = await Promise.all([
    searchProducts(context.shop.id, "", 20, warehouse.id),
    listCustomerOptions(context.shop.id),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Caisse"
        title="Nouvelle vente"
        description={`Vente depuis l'entrepôt ${warehouse.name} (${warehouse.code}). Composez le panier, choisissez le client et le moyen de paiement : le serveur recalcule les prix et décrémente le stock dans une transaction unique.`}
        actions={
          <Link href="/sales" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Ventes récentes
          </Link>
        }
      />
      <PosTerminal
        initialProducts={products}
        customers={customers}
        currency={context.shop.currency}
        canDiscount={context.permissions.has("discounts.apply")}
        initialCustomerId={firstParam(params.customerId)}
      />
    </div>
  );
}

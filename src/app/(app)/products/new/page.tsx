import Link from "next/link";

import { PageHeader } from "@/components/ui/page";
import { ProductForm } from "@/components/products/product-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { listCategoriesWithCounts } from "@/server/services/products";
import { listSupplierOptions } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const context = await requirePage("products.write");
  const [categories, suppliers] = await Promise.all([
    listCategoriesWithCounts(context.shop.id),
    listSupplierOptions(context.shop.id),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Nouveau produit"
        description="Ajoutez une référence, son prix et son stock initial. Le stock initial génère automatiquement un mouvement d'entrée."
        actions={
          <Link
            href="/products"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Retour au catalogue
          </Link>
        }
      />
      <ProductForm
        mode="create"
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        suppliers={suppliers}
        currency={context.shop.currency}
      />
    </div>
  );
}

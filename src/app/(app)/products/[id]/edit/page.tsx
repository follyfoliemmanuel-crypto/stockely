import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page";
import { ProductForm } from "@/components/products/product-form";
import { buttonClasses } from "@/components/ui/button";
import { requirePage } from "@/server/auth/page";
import { isAiConfigured } from "@/server/ai/client";
import {
  getProduct,
  listCategoriesWithCounts,
} from "@/server/services/products";
import { listSupplierOptions } from "@/server/services/suppliers";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifier un produit" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePage("products.write");
  const { id } = await params;

  const [row, categories, suppliers] = await Promise.all([
    getProduct(context.shop.id, id),
    listCategoriesWithCounts(context.shop.id),
    listSupplierOptions(context.shop.id),
  ]);

  if (!row) notFound();

  const product = row.product;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title={`Modifier ${product.name}`}
        description="Les changements de prix s'appliquent aux prochaines ventes. Les ventes passées conservent leur prix."
        actions={
          <Link
            href={`/products/${product.id}`}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Voir la fiche
          </Link>
        }
      />
      <ProductForm
        mode="edit"
        product={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          description: product.description,
          categoryId: product.categoryId,
          supplierId: product.supplierId,
          priceCents: product.priceCents,
          costCents: product.costCents,
          minStock: product.minStock,
          quantity: product.quantity,
        }}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
        }))}
        suppliers={suppliers}
        currency={context.shop.currency}
        aiEnabled={isAiConfigured()}
      />
    </div>
  );
}

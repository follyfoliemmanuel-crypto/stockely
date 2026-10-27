import { PageHeader } from "@/components/ui/page";
import { CategoryManager } from "@/components/categories/category-manager";
import { requirePage } from "@/server/auth/page";
import { listCategoriesWithCounts } from "@/server/services/products";

export const dynamic = "force-dynamic";

export const metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const context = await requirePage("categories.read");
  const categories = await listCategoriesWithCounts(context.shop.id);
  const canWrite = context.permissions.has("categories.write");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Catégories"
        description="Organisez le catalogue par famille de produits. Les catégories facilitent la recherche et les rapports."
      />
      <CategoryManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          productCount: Number(category.productCount),
        }))}
        canWrite={canWrite}
      />
    </div>
  );
}

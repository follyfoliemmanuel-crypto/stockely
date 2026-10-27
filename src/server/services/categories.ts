import { and, asc, eq, sql } from "drizzle-orm";

import { writeAudit } from "@/server/audit";
import type { AuthContext } from "@/server/auth/context";
import { getDb } from "@/server/db";
import { isUniqueViolation } from "@/server/db/errors";
import { categories, products } from "@/server/db/schema";
import { ApiError } from "@/server/http";
import { isUuid } from "@/lib/uuid";
import type { CategoryInput } from "@/server/validation/catalog";

export async function listCategories(shopId: string) {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(eq(products.categoryId, categories.id), eq(products.isArchived, false)),
    )
    .where(eq(categories.shopId, shopId))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
}

export async function createCategory(
  context: AuthContext,
  input: CategoryInput,
): Promise<{ id: string }> {
  try {
    return await getDb().transaction(async (tx) => {
      const [category] = await tx
        .insert(categories)
        .values({
          shopId: context.shop.id,
          name: input.name,
          description: input.description,
        })
        .returning({ id: categories.id });

      if (!category) throw new Error("Création de la catégorie impossible");

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "category.created",
        entityType: "category",
        entityId: category.id,
        metadata: { name: input.name },
      });

      return { id: category.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        409,
        "category_exists",
        "Une catégorie porte déjà ce nom dans cette boutique.",
      );
    }
    throw error;
  }
}

export async function updateCategory(
  context: AuthContext,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  const db = getDb();
  if (!isUuid(categoryId)) {
    throw new ApiError(404, "category_not_found", "Catégorie introuvable.");
  }

  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.shopId, context.shop.id)))
    .limit(1);

  if (!existing[0]) {
    throw new ApiError(404, "category_not_found", "Catégorie introuvable.");
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(categories)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.id, categoryId), eq(categories.shopId, context.shop.id)));

      await writeAudit(tx as never, {
        shopId: context.shop.id,
        userId: context.user.id,
        action: "category.updated",
        entityType: "category",
        entityId: categoryId,
        metadata: { name: input.name },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(
        409,
        "category_exists",
        "Une catégorie porte déjà ce nom dans cette boutique.",
      );
    }
    throw error;
  }
}

export async function deleteCategory(
  context: AuthContext,
  categoryId: string,
): Promise<void> {
  const db = getDb();
  if (!isUuid(categoryId)) {
    throw new ApiError(404, "category_not_found", "Catégorie introuvable.");
  }

  const rows = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.shopId, context.shop.id)))
    .limit(1);

  const existing = rows[0];
  if (!existing) {
    throw new ApiError(404, "category_not_found", "Catégorie introuvable.");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.shopId, context.shop.id)));

    await writeAudit(tx as never, {
      shopId: context.shop.id,
      userId: context.user.id,
      action: "category.deleted",
      entityType: "category",
      entityId: categoryId,
      metadata: { name: existing.name },
    });
  });
}

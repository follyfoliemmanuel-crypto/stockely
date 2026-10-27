import {
  assertCsrf,
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import {
  assertSameOrigin,
  assertUuidParam,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { deleteCategory, updateCategory } from "@/server/services/categories";
import { categorySchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "categories.write");

    const { id } = await params;
    assertUuidParam(id, "Catégorie");
    const input = await readJson(request, categorySchema);
    await updateCategory(context, id, input);

    return jsonOk({ updated: true });
  },
);

export const DELETE = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "categories.write");

    const { id } = await params;
    assertUuidParam(id, "Catégorie");
    await deleteCategory(context, id);

    return jsonOk({ deleted: true });
  },
);

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
import { updateProduct } from "@/server/services/products";
import { productUpdateSchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "products.write");

    const { id } = await params;
    assertUuidParam(id, "Produit");
    const input = await readJson(request, productUpdateSchema);
    await updateProduct(context, id, input);

    return jsonOk({ updated: true });
  },
);

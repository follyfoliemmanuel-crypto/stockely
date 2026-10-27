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
import { setProductArchived } from "@/server/services/products";
import { productArchiveSchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "products.write");

    const { id } = await params;
    assertUuidParam(id, "Produit");
    const input = await readJson(request, productArchiveSchema);
    await setProductArchived(context, id, input.archived);

    return jsonOk({ archived: input.archived });
  },
);

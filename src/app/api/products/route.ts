import {
  assertCsrf,
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import {
  assertSameOrigin,
  jsonOk,
  readJson,
  route,
} from "@/server/http";
import { resolveRequestWarehouse } from "@/server/auth/warehouse";
import { createProduct } from "@/server/services/products";
import { productCreateSchema } from "@/server/validation/catalog";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "products.write");

  const input = await readJson(request, productCreateSchema);
  const warehouse = await resolveRequestWarehouse(context);
  const product = await createProduct(context, input, warehouse.id);

  return jsonOk(product, 201);
});

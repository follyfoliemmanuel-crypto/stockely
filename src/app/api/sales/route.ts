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
import { createSale } from "@/server/services/sales";
import { saleCreateSchema } from "@/server/validation/sales";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "sales.create");

  const input = await readJson(request, saleCreateSchema);
  const warehouse = await resolveRequestWarehouse(context);
  const sale = await createSale(context, input, warehouse.id);

  return jsonOk(sale, 201);
});

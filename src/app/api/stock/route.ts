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
import { recordStockMovement } from "@/server/services/stock";
import { stockMovementSchema } from "@/server/validation/stock";

export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "stock.write");

  const input = await readJson(request, stockMovementSchema);
  const warehouse = await resolveRequestWarehouse(context);
  const result = await recordStockMovement(context, input, warehouse.id);

  return jsonOk(result, 201);
});

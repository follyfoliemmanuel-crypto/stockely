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
import {
  createWarehouse,
  listAccessibleWarehouses,
  listWarehouseOverview,
} from "@/server/services/warehouses";
import { warehouseCreateSchema } from "@/server/validation/warehouses";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const context = await requireAuth();
  requirePermission(context, "warehouses.read");

  const warehouses = await listAccessibleWarehouses(context);
  return jsonOk({ items: warehouses });
});

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "warehouses.write");

  const input = await readJson(request, warehouseCreateSchema);
  const warehouse = await createWarehouse(context, input);
  const overview = await listWarehouseOverview(context.shop.id);
  const created = overview.find((row) => row.id === warehouse.id) ?? null;

  return jsonOk({ warehouse: created }, 201);
});

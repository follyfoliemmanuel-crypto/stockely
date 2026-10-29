import {
  assertCsrf,
  requireAuth,
  requirePermission,
} from "@/server/auth/context";
import {
  assertSameOrigin,
  jsonOk,
  readJson,
  readQuery,
  route,
} from "@/server/http";
import {
  createTransfer,
  listTransfers,
} from "@/server/services/transfers";
import {
  transferCreateSchema,
  transferListQuerySchema,
} from "@/server/validation/transfers";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "transfers.read");

  const query = readQuery(request, transferListQuerySchema);

  const result = await listTransfers(context, {
    status: query.status,
    fromWarehouseId: query.fromWarehouseId,
    toWarehouseId: query.toWarehouseId,
    warehouseId: query.warehouseId,
    q: query.q,
    page: query.page,
  });

  return jsonOk(result);
});

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "transfers.create");

  const input = await readJson(request, transferCreateSchema);
  const result = await createTransfer(context, input);

  return jsonOk(result, 201);
});

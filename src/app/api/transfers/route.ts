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
  createTransfer,
  listTransfers,
} from "@/server/services/transfers";
import { transferCreateSchema } from "@/server/validation/transfers";
import type { TransferStatus } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const context = await requireAuth();
  requirePermission(context, "transfers.read");

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const validStatuses = new Set<string>(["prepared", "shipped", "received", "cancelled"]);
  const status = statusParam && validStatuses.has(statusParam)
    ? (statusParam as TransferStatus)
    : undefined;

  const page = Number(url.searchParams.get("page") ?? "1");
  const fromWarehouseId = url.searchParams.get("fromWarehouseId") ?? undefined;
  const toWarehouseId = url.searchParams.get("toWarehouseId") ?? undefined;
  const warehouseId = url.searchParams.get("warehouseId") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const result = await listTransfers(context, {
    status,
    fromWarehouseId,
    toWarehouseId,
    warehouseId,
    q,
    page: Number.isFinite(page) && page > 0 ? page : 1,
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

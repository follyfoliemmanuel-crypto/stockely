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
import { setWarehouseAccess } from "@/server/services/warehouses";
import { warehouseAccessSchema } from "@/server/validation/warehouses";

export const dynamic = "force-dynamic";

export const PUT = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "warehouses.write");

    const { id } = await params;
    assertUuidParam(id, "Entrepôt");
    const input = await readJson(request, warehouseAccessSchema);
    await setWarehouseAccess(context, id, input);

    return jsonOk({ updated: true });
  },
);

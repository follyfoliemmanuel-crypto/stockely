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
import { updateWarehouse } from "@/server/services/warehouses";
import { warehouseUpdateSchema } from "@/server/validation/warehouses";

export const dynamic = "force-dynamic";

export const PATCH = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "warehouses.write");

    const { id } = await params;
    assertUuidParam(id, "Entrepôt");
    const input = await readJson(request, warehouseUpdateSchema);
    await updateWarehouse(context, id, input);

    return jsonOk({ updated: true });
  },
);

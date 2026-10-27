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
import { setWarehouseArchived } from "@/server/services/warehouses";
import { warehouseArchiveSchema } from "@/server/validation/warehouses";

export const dynamic = "force-dynamic";

export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "warehouses.write");

    const { id } = await params;
    assertUuidParam(id, "Entrepôt");
    const input = await readJson(request, warehouseArchiveSchema);
    await setWarehouseArchived(context, id, input.archived);

    return jsonOk({ archived: input.archived });
  },
);

import { z } from "zod";

import { assertCsrf, requireAuth } from "@/server/auth/context";
import { setRequestWarehouseCookie } from "@/server/auth/warehouse";
import { assertSameOrigin, jsonOk, readJson, route } from "@/server/http";
import { resolveWarehouse } from "@/server/services/warehouses";

export const dynamic = "force-dynamic";

const switchSchema = z.object({ warehouseId: z.string().uuid() });

export const POST = route(async (request: Request) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);

  const { warehouseId } = await readJson(request, switchSchema);
  // La résolution vérifie l'appartenance et les autorisations explicites.
  const warehouse = await resolveWarehouse(context, warehouseId);

  await setRequestWarehouseCookie(warehouse.id);

  return jsonOk({
    warehouse: {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
    },
  });
});

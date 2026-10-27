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
import { cancelSale } from "@/server/services/sales";
import { saleCancelSchema } from "@/server/validation/sales";

export const dynamic = "force-dynamic";

export const POST = route(
  async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const context = await requireAuth();
    assertSameOrigin(request);
    assertCsrf(request, context);
    requirePermission(context, "sales.cancel");

    const { id } = await params;
    assertUuidParam(id, "Vente");
    const input = await readJson(request, saleCancelSchema);
    await cancelSale(context, id, input.reason);

    return jsonOk({ cancelled: true });
  },
);

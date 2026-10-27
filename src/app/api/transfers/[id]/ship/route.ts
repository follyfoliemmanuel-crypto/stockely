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
import { shipTransfer } from "@/server/services/transfers";
import { transferShipSchema } from "@/server/validation/transfers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = route(async (request: Request, { params }: RouteParams) => {
  const context = await requireAuth();
  assertSameOrigin(request);
  assertCsrf(request, context);
  requirePermission(context, "transfers.ship");

  const { id } = await params;
  const input = await readJson(request, transferShipSchema);
  await shipTransfer(context, id, input);

  return jsonOk({ success: true });
});
